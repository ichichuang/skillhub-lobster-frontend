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
 * Proves the admin skill detail resolves any skill by numeric id regardless of
 * owner, hidden overlay, or lifecycle status, and returns the authoritative
 * version history instead of a public-only projection.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(TestRedisConfig.class)
class AdminSkillDetailIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private NamespaceRepository namespaceRepository;

    @Autowired
    private SkillRepository skillRepository;

    @Autowired
    private SkillVersionRepository skillVersionRepository;

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
    void skillDetail_returnsFullHistoryForActiveVisibleSkill() throws Exception {
        String suffix = uniqueSuffix();
        Namespace namespace = createNamespace(suffix);
        createOwner("owner-a-" + suffix, "Owner A");
        Skill skill = createSkill(namespace, "active", "owner-a-" + suffix, false, SkillStatus.ACTIVE);
        createVersion(skill, "0.9.0", SkillVersionStatus.DRAFT, 2, 2048L, null);
        createVersion(skill, "1.0.0", SkillVersionStatus.PUBLISHED, 5, 8192L, null);
        skill.setLatestVersionId(
                skillVersionRepository.findBySkillIdAndVersion(skill.getId(), "1.0.0").orElseThrow().getId());
        skillRepository.save(skill);
        skillRepository.flush();

        mockMvc.perform(get("/api/v1/admin/skills/" + skill.getId()).with(authentication(superAdminAuth())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.skill.id").value(skill.getId().intValue()))
                .andExpect(jsonPath("$.data.skill.namespace").value("admin-detail-" + suffix))
                .andExpect(jsonPath("$.data.skill.slug").value("admin-detail-" + suffix + "-active"))
                .andExpect(jsonPath("$.data.skill.ownerId").value("owner-a-" + suffix))
                .andExpect(jsonPath("$.data.skill.ownerDisplayName").value("Owner A"))
                .andExpect(jsonPath("$.data.skill.hidden").value(false))
                .andExpect(jsonPath("$.data.summary").value("Summary " + suffix))
                .andExpect(jsonPath("$.data.versions.length()").value(2))
                // PUBLISHED versions sort ahead of DRAFT ones.
                .andExpect(jsonPath("$.data.versions[0].version").value("1.0.0"))
                .andExpect(jsonPath("$.data.versions[0].status").value("PUBLISHED"))
                .andExpect(jsonPath("$.data.versions[0].fileCount").value(5))
                .andExpect(jsonPath("$.data.versions[0].totalSize").value(8192))
                .andExpect(jsonPath("$.data.versions[1].version").value("0.9.0"))
                .andExpect(jsonPath("$.data.versions[1].status").value("DRAFT"))
                .andExpect(jsonPath("$.data.versions[1].fileCount").value(2))
                .andExpect(jsonPath("$.data.versions[1].totalSize").value(2048));
    }

    @Test
    void skillDetail_resolvesHiddenSkillOfAnotherOwner() throws Exception {
        String suffix = uniqueSuffix();
        Namespace namespace = createNamespace(suffix);
        createOwner("owner-b-" + suffix, "Owner B");
        Skill skill = createSkill(namespace, "ghost", "owner-b-" + suffix, true, SkillStatus.ACTIVE);

        mockMvc.perform(get("/api/v1/admin/skills/" + skill.getId()).with(authentication(superAdminAuth())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.skill.id").value(skill.getId().intValue()))
                .andExpect(jsonPath("$.data.skill.hidden").value(true))
                .andExpect(jsonPath("$.data.skill.ownerId").value("owner-b-" + suffix));
    }

    @Test
    void skillDetail_resolvesArchivedSkill() throws Exception {
        String suffix = uniqueSuffix();
        Namespace namespace = createNamespace(suffix);
        createOwner("owner-a-" + suffix, "Owner A");
        Skill skill = createSkill(namespace, "retired", "owner-a-" + suffix, false, SkillStatus.ARCHIVED);

        mockMvc.perform(get("/api/v1/admin/skills/" + skill.getId()).with(authentication(superAdminAuth())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.skill.status").value("ARCHIVED"));
    }

    @Test
    void skillDetail_includesYankedVersionsInHistory() throws Exception {
        String suffix = uniqueSuffix();
        Namespace namespace = createNamespace(suffix);
        createOwner("owner-a-" + suffix, "Owner A");
        Skill skill = createSkill(namespace, "yanked", "owner-a-" + suffix, false, SkillStatus.ACTIVE);
        createVersion(skill, "1.0.0", SkillVersionStatus.YANKED, 3, 4096L, null);

        mockMvc.perform(get("/api/v1/admin/skills/" + skill.getId()).with(authentication(superAdminAuth())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.versions.length()").value(1))
                .andExpect(jsonPath("$.data.versions[0].status").value("YANKED"))
                .andExpect(jsonPath("$.data.versions[0].fileCount").value(3));
    }

    @Test
    void skillDetail_nonexistentSkill_returns404() throws Exception {
        mockMvc.perform(get("/api/v1/admin/skills/999999999").with(authentication(superAdminAuth())))
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
                new Namespace("admin-detail-" + suffix, "Admin Detail " + suffix, "system"));
    }

    private Skill createSkill(Namespace namespace, String marker, String ownerId, boolean hidden, SkillStatus status) {
        Skill skill = new Skill(namespace.getId(), namespace.getSlug() + "-" + marker, ownerId, SkillVisibility.PUBLIC);
        skill.setDisplayName("Admin Detail " + marker);
        skill.setSummary("Summary " + suffix(namespace));
        skill.setCreatedBy(ownerId);
        skill.setUpdatedBy(ownerId);
        skill.setStatus(status);
        if (hidden) {
            skill.setHidden(true);
        }
        return skillRepository.save(skill);
    }

    private String suffix(Namespace namespace) {
        return namespace.getSlug().substring("admin-detail-".length());
    }

    private void createVersion(Skill skill,
                               String version,
                               SkillVersionStatus status,
                               int fileCount,
                               Long totalSize,
                               java.time.Instant publishedAt) {
        SkillVersion entity = new SkillVersion(skill.getId(), version, "owner");
        entity.setStatus(status);
        entity.setChangelog("Changelog " + version);
        entity.setFileCount(fileCount);
        entity.setTotalSize(totalSize);
        if (publishedAt != null) {
            entity.setPublishedAt(publishedAt);
        }
        skillVersionRepository.save(entity);
        skillVersionRepository.flush();
    }
}
