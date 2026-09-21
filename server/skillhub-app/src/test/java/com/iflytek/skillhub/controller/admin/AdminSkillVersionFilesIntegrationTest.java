package com.iflytek.skillhub.controller.admin;

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

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Proves the platform-admin version file listing returns read-only packaged
 * file metadata — never storage keys — for any owner's visible, hidden, and
 * archived skills, validates that the requested version belongs to the
 * requested skill, and rejects ordinary roles.
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
    void listVersionFiles_superAdmin_listsAnotherUsersVisibleSkillFiles() throws Exception {
        Skill skill = createSkillWithOwner("files-owner", false, SkillStatus.ACTIVE);
        SkillVersion version = createVersion(skill, "1.0.0", SkillVersionStatus.PUBLISHED);
        createFile(version, "SKILL.md", 1024L, "text/markdown", "a".repeat(64));
        createFile(version, "scripts/run.sh", 2048L, "text/x-shellscript", "b".repeat(64));

        mockMvc.perform(get("/api/v1/admin/skills/{skillId}/versions/{versionId}/files", skill.getId(), version.getId())
                        .with(authentication(superAdminAuth())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].filePath").value("SKILL.md"))
                .andExpect(jsonPath("$.data[0].fileSize").value(1024))
                .andExpect(jsonPath("$.data[0].contentType").value("text/markdown"))
                .andExpect(jsonPath("$.data[0].sha256").value("a".repeat(64)))
                .andExpect(jsonPath("$.data[1].filePath").value("scripts/run.sh"))
                .andExpect(jsonPath("$.data[1].fileSize").value(2048))
                .andExpect(jsonPath("$.data[0].storageKey").doesNotExist());
    }

    @Test
    void listVersionFiles_superAdmin_listsHiddenSkillFiles() throws Exception {
        Skill skill = createSkillWithOwner("files-hidden-owner", true, SkillStatus.ACTIVE);
        SkillVersion version = createVersion(skill, "1.0.0", SkillVersionStatus.PUBLISHED);
        createFile(version, "SKILL.md", 512L, "text/markdown", "c".repeat(64));

        mockMvc.perform(get("/api/v1/admin/skills/{skillId}/versions/{versionId}/files", skill.getId(), version.getId())
                        .with(authentication(superAdminAuth())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].filePath").value("SKILL.md"))
                .andExpect(jsonPath("$.data[0].fileSize").value(512));
    }

    @Test
    void listVersionFiles_superAdmin_listsArchivedSkillFiles() throws Exception {
        Skill skill = createSkillWithOwner("files-archived-owner", false, SkillStatus.ARCHIVED);
        SkillVersion version = createVersion(skill, "0.9.0", SkillVersionStatus.PUBLISHED);
        createFile(version, "docs/usage.md", 4096L, "text/markdown", "d".repeat(64));

        mockMvc.perform(get("/api/v1/admin/skills/{skillId}/versions/{versionId}/files", skill.getId(), version.getId())
                        .with(authentication(superAdminAuth())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].filePath").value("docs/usage.md"))
                .andExpect(jsonPath("$.data[0].fileSize").value(4096));
    }

    @Test
    void listVersionFiles_emptyVersionReturnsEmptyList() throws Exception {
        Skill skill = createSkillWithOwner("files-empty-owner", false, SkillStatus.ACTIVE);
        SkillVersion version = createVersion(skill, "1.1.0", SkillVersionStatus.UPLOADED);

        mockMvc.perform(get("/api/v1/admin/skills/{skillId}/versions/{versionId}/files", skill.getId(), version.getId())
                        .with(authentication(superAdminAuth())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(0));
    }

    @Test
    void listVersionFiles_rejectsVersionBelongingToAnotherSkill() throws Exception {
        Skill skillA = createSkillWithOwner("files-a-owner", false, SkillStatus.ACTIVE);
        Skill skillB = createSkillWithOwner("files-b-owner", false, SkillStatus.ACTIVE);
        SkillVersion versionA = createVersion(skillA, "1.0.0", SkillVersionStatus.PUBLISHED);
        createFile(versionA, "SKILL.md", 256L, "text/markdown", "e".repeat(64));

        mockMvc.perform(get("/api/v1/admin/skills/{skillId}/versions/{versionId}/files", skillB.getId(), versionA.getId())
                        .with(authentication(superAdminAuth())))
                .andExpect(status().isBadRequest());
    }

    @Test
    void listVersionFiles_unknownVersionIsRejected() throws Exception {
        Skill skill = createSkillWithOwner("files-unknown-owner", false, SkillStatus.ACTIVE);

        mockMvc.perform(get("/api/v1/admin/skills/{skillId}/versions/{versionId}/files", skill.getId(), 9_999_999)
                        .with(authentication(superAdminAuth())))
                .andExpect(status().isBadRequest());
    }

    @Test
    void listVersionFiles_unauthorizedRolesAreRejected() throws Exception {
        Skill skill = createSkillWithOwner("files-plain-owner", true, SkillStatus.ACTIVE);
        SkillVersion version = createVersion(skill, "1.0.0", SkillVersionStatus.PUBLISHED);

        mockMvc.perform(get("/api/v1/admin/skills/{skillId}/versions/{versionId}/files", skill.getId(), version.getId()))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/v1/admin/skills/{skillId}/versions/{versionId}/files", skill.getId(), version.getId())
                        .with(authentication(plainUserAuth())))
                .andExpect(status().isForbidden());
    }

    private UsernamePasswordAuthenticationToken superAdminAuth() {
        return auth("super-1", "SUPER_ADMIN");
    }

    private UsernamePasswordAuthenticationToken plainUserAuth() {
        return auth("plain-1", "USER");
    }

    private UsernamePasswordAuthenticationToken auth(String userId, String role) {
        PlatformPrincipal principal = new PlatformPrincipal(
                userId, userId, userId + "@example.com", "", "session", Set.of(role));
        return new UsernamePasswordAuthenticationToken(
                principal, null, List.of(new SimpleGrantedAuthority("ROLE_" + role)));
    }

    private Skill createSkillWithOwner(String ownerId, boolean hidden, SkillStatus status) {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        userAccountRepository.save(new UserAccount(ownerId + "-" + suffix, "Files Owner", ownerId + suffix + "@example.com", null));
        Namespace namespace = namespaceRepository.save(
                new Namespace("admin-files-" + suffix, "Admin Files " + suffix, "system"));
        Skill skill = new Skill(namespace.getId(), "admin-files-" + suffix + "-skill", ownerId + "-" + suffix, SkillVisibility.PUBLIC);
        skill.setDisplayName("Admin Files " + suffix);
        skill.setSummary("File listing summary " + suffix);
        skill.setCreatedBy(ownerId + "-" + suffix);
        skill.setUpdatedBy(ownerId + "-" + suffix);
        if (hidden) {
            skill.setHidden(true);
        }
        skill.setStatus(status);
        return skillRepository.save(skill);
    }

    private SkillVersion createVersion(Skill skill, String version, SkillVersionStatus status) {
        SkillVersion skillVersion = new SkillVersion(skill.getId(), version, skill.getOwnerId());
        skillVersion.setStatus(status);
        return skillVersionRepository.save(skillVersion);
    }

    private void createFile(SkillVersion version, String filePath, long fileSize, String contentType, String sha256) {
        skillFileRepository.save(new SkillFile(
                version.getId(), filePath, fileSize, contentType, sha256, "internal/storage/" + version.getId() + "/" + filePath));
    }
}
