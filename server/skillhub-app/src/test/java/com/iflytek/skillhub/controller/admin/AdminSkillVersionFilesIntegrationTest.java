package com.iflytek.skillhub.controller.admin;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.iflytek.skillhub.TestRedisConfig;
import com.iflytek.skillhub.auth.device.DeviceAuthService;
import com.iflytek.skillhub.auth.rbac.PlatformPrincipal;
import com.iflytek.skillhub.domain.namespace.Namespace;
import com.iflytek.skillhub.domain.namespace.NamespaceMemberRepository;
import com.iflytek.skillhub.domain.namespace.NamespaceRepository;
import com.iflytek.skillhub.domain.skill.Skill;
import com.iflytek.skillhub.domain.skill.SkillFile;
import com.iflytek.skillhub.domain.skill.SkillFileRepository;
import com.iflytek.skillhub.domain.skill.SkillRepository;
import com.iflytek.skillhub.domain.skill.SkillStatus;
import com.iflytek.skillhub.domain.skill.SkillVersion;
import com.iflytek.skillhub.domain.skill.SkillVersionRepository;
import com.iflytek.skillhub.domain.skill.SkillVersionStatus;
import com.iflytek.skillhub.domain.skill.SkillVisibility;
import com.iflytek.skillhub.domain.user.UserAccount;
import com.iflytek.skillhub.domain.user.UserAccountRepository;
import com.iflytek.skillhub.search.SearchIndexService;
import com.iflytek.skillhub.storage.ObjectStorageService;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Proves the admin version-file listing returns only safe package metadata for
 * a version that belongs to the addressed skill, and never leaks the internal
 * object-storage key.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(TestRedisConfig.class)
class AdminSkillVersionFilesIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private NamespaceRepository namespaceRepository;

    @Autowired
    private SkillRepository skillRepository;

    @Autowired
    private SkillVersionRepository skillVersionRepository;

    @Autowired
    private SkillFileRepository skillFileRepository;

    @Autowired
    private UserAccountRepository userAccountRepository;

    @MockBean
    private SearchIndexService searchIndexService;

    @MockBean
    private ObjectStorageService objectStorageService;

    @MockBean
    private NamespaceMemberRepository namespaceMemberRepository;

    @MockBean
    private DeviceAuthService deviceAuthService;

    @Test
    void versionFiles_returnsSafeMetadataForOwnedVersion() throws Exception {
        String suffix = uniqueSuffix();
        Namespace namespace = createNamespace(suffix);
        createOwner("owner-a-" + suffix, "Owner A");
        Skill skill = createSkill(namespace, "files", "owner-a-" + suffix);
        SkillVersion version = createVersion(skill, "1.0.0");
        createFile(version.getId(), "SKILL.md", 512L, "text/markdown", "abc123", "tenant/path/SKILL.md");
        createFile(version.getId(), "refs/main.md", 256L, "text/markdown", "def456", "tenant/path/main.md");

        mockMvc.perform(get("/api/v1/admin/skills/" + skill.getId() + "/versions/" + version.getId() + "/files")
                        .with(authentication(superAdminAuth())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].filePath").value("SKILL.md"))
                .andExpect(jsonPath("$.data[0].fileSize").value(512))
                .andExpect(jsonPath("$.data[0].contentType").value("text/markdown"))
                .andExpect(jsonPath("$.data[0].sha256").value("abc123"))
                .andExpect(jsonPath("$.data[1].filePath").value("refs/main.md"))
                // The response model has no storageKey field at all.
                .andExpect(jsonPath("$.data[0].storageKey").doesNotExist())
                .andExpect(jsonPath("$.data[1].storageKey").doesNotExist());
    }

    @Test
    void versionFiles_versionOfAnotherSkill_returns404() throws Exception {
        String suffix = uniqueSuffix();
        Namespace namespace = createNamespace(suffix);
        createOwner("owner-a-" + suffix, "Owner A");
        Skill skillOne = createSkill(namespace, "one", "owner-a-" + suffix);
        Skill skillTwo = createSkill(namespace, "two", "owner-a-" + suffix);
        SkillVersion versionOfSkillTwo = createVersion(skillTwo, "1.0.0");

        mockMvc.perform(get("/api/v1/admin/skills/" + skillOne.getId() + "/versions/" + versionOfSkillTwo.getId() + "/files")
                        .with(authentication(superAdminAuth())))
                .andExpect(status().isNotFound());
    }

    @Test
    void versionFiles_nonexistentSkillOrVersion_returns404() throws Exception {
        String suffix = uniqueSuffix();
        Namespace namespace = createNamespace(suffix);
        createOwner("owner-a-" + suffix, "Owner A");
        Skill skill = createSkill(namespace, "solo", "owner-a-" + suffix);

        mockMvc.perform(get("/api/v1/admin/skills/999999999/versions/1/files")
                        .with(authentication(superAdminAuth())))
                .andExpect(status().isNotFound());

        mockMvc.perform(get("/api/v1/admin/skills/" + skill.getId() + "/versions/999999999/files")
                        .with(authentication(superAdminAuth())))
                .andExpect(status().isNotFound());
    }

    private UsernamePasswordAuthenticationToken superAdminAuth() {
        PlatformPrincipal principal = new PlatformPrincipal(
                "super-1", "superadmin", "super@example.com", "", "session", Set.of("SUPER_ADMIN"));
        return new UsernamePasswordAuthenticationToken(
                principal, null, List.of(new SimpleGrantedAuthority("ROLE_SUPER_ADMIN")));
    }

    private String uniqueSuffix() {
        return UUID.randomUUID().toString().substring(0, 8);
    }

    private void createOwner(String ownerId, String displayName) {
        userAccountRepository.save(new UserAccount(ownerId, displayName, ownerId + "@example.com", null));
    }

    private Namespace createNamespace(String suffix) {
        return namespaceRepository.save(
                new Namespace("admin-files-" + suffix, "Admin Files " + suffix, "system"));
    }

    private Skill createSkill(Namespace namespace, String marker, String ownerId) {
        Skill skill = new Skill(namespace.getId(), namespace.getSlug() + "-" + marker, ownerId, SkillVisibility.PUBLIC);
        skill.setDisplayName("Admin Files " + marker);
        skill.setCreatedBy(ownerId);
        skill.setUpdatedBy(ownerId);
        skill.setStatus(SkillStatus.ACTIVE);
        return skillRepository.save(skill);
    }

    private SkillVersion createVersion(Skill skill, String version) {
        SkillVersion entity = new SkillVersion(skill.getId(), version, "owner");
        entity.setStatus(SkillVersionStatus.PUBLISHED);
        entity = skillVersionRepository.save(entity);
        skillVersionRepository.flush();
        return entity;
    }

    private void createFile(Long versionId, String filePath, Long fileSize, String contentType, String sha256, String storageKey) {
        skillFileRepository.save(new SkillFile(versionId, filePath, fileSize, contentType, sha256, storageKey));
    }
}
