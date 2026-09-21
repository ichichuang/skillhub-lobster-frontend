package com.iflytek.skillhub.controller.admin;

import com.iflytek.skillhub.TestRedisConfig;
import com.iflytek.skillhub.auth.device.DeviceAuthService;
import com.iflytek.skillhub.auth.rbac.PlatformPrincipal;
import com.iflytek.skillhub.domain.label.LabelDefinition;
import com.iflytek.skillhub.domain.label.LabelDefinitionRepository;
import com.iflytek.skillhub.domain.label.LabelTranslation;
import com.iflytek.skillhub.domain.label.LabelTranslationRepository;
import com.iflytek.skillhub.domain.label.LabelType;
import com.iflytek.skillhub.domain.label.SkillLabel;
import com.iflytek.skillhub.domain.label.SkillLabelRepository;
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
import java.time.Instant;
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
 * Proves the platform-admin detail endpoint returns administrator-readable
 * details — including the skill summary and full version history — for any
 * owner's visible, hidden, and archived skills, while ordinary roles stay
 * rejected.
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

    @Autowired
    private LabelDefinitionRepository labelDefinitionRepository;

    @Autowired
    private LabelTranslationRepository labelTranslationRepository;

    @Autowired
    private SkillLabelRepository skillLabelRepository;

    @MockBean
    private SearchIndexService searchIndexService;

    @MockBean
    private ObjectStorageService objectStorageService;

    @MockBean
    private NamespaceMemberRepository namespaceMemberRepository;

    @MockBean
    private DeviceAuthService deviceAuthService;

    @Test
    void getSkillDetail_superAdmin_readsAnotherUsersVisibleSkillWithSummaryLabelsAndVersions() throws Exception {
        String suffix = uniqueSuffix();
        Namespace namespace = createNamespace(suffix);
        createOwner("detail-owner-" + suffix, "Detail Owner");
        String summary = "Admin detail summary " + suffix;
        Skill skill = createSkill(namespace, "visible", "detail-owner-" + suffix, false, SkillStatus.ACTIVE, summary);
        Long labelId = createLabel("official-" + suffix, "Official " + suffix);
        attachLabel(skill.getId(), labelId);
        createVersion(skill, "1.0.0", SkillVersionStatus.PUBLISHED, "First release", 3, 2048L);

        mockMvc.perform(get("/api/v1/admin/skills/{skillId}", skill.getId()).with(authentication(superAdminAuth())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.skill.id").value(skill.getId()))
                .andExpect(jsonPath("$.data.skill.namespace").value("admin-detail-" + suffix))
                .andExpect(jsonPath("$.data.skill.slug").value("admin-detail-" + suffix + "-visible"))
                .andExpect(jsonPath("$.data.skill.displayName").value("Admin Detail " + suffix))
                .andExpect(jsonPath("$.data.summary").value("Admin detail summary " + suffix))
                .andExpect(jsonPath("$.data.skill.ownerId").value("detail-owner-" + suffix))
                .andExpect(jsonPath("$.data.skill.ownerDisplayName").value("Detail Owner"))
                .andExpect(jsonPath("$.data.skill.visibility").value("PUBLIC"))
                .andExpect(jsonPath("$.data.skill.status").value("ACTIVE"))
                .andExpect(jsonPath("$.data.skill.hidden").value(false))
                .andExpect(jsonPath("$.data.skill.createdAt").isNotEmpty())
                .andExpect(jsonPath("$.data.skill.updatedAt").isNotEmpty())
                .andExpect(jsonPath("$.data.skill.labels[0].slug").value("official-" + suffix))
                .andExpect(jsonPath("$.data.skill.labels[0].displayName").value("Official " + suffix))
                .andExpect(jsonPath("$.data.skill.headlineVersion.version").value("1.0.0"))
                .andExpect(jsonPath("$.data.skill.publishedVersion.status").value("PUBLISHED"))
                .andExpect(jsonPath("$.data.versions.length()").value(1))
                .andExpect(jsonPath("$.data.versions[0].version").value("1.0.0"))
                .andExpect(jsonPath("$.data.versions[0].status").value("PUBLISHED"))
                .andExpect(jsonPath("$.data.versions[0].changelog").value("First release"))
                .andExpect(jsonPath("$.data.versions[0].fileCount").value(3))
                .andExpect(jsonPath("$.data.versions[0].totalSize").value(2048))
                .andExpect(jsonPath("$.data.versions[0].publishedAt").isNotEmpty());
    }

    @Test
    void getSkillDetail_superAdmin_readsHiddenSkillOfAnotherOwner() throws Exception {
        String suffix = uniqueSuffix();
        Namespace namespace = createNamespace(suffix);
        createOwner("hidden-owner-" + suffix, "Hidden Owner");
        String summary = "Admin detail summary " + suffix;
        Skill skill = createSkill(namespace, "hidden", "hidden-owner-" + suffix, true, SkillStatus.ACTIVE, summary);

        mockMvc.perform(get("/api/v1/admin/skills/{skillId}", skill.getId()).with(authentication(superAdminAuth())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.skill.slug").value("admin-detail-" + suffix + "-hidden"))
                .andExpect(jsonPath("$.data.skill.hidden").value(true))
                .andExpect(jsonPath("$.data.skill.status").value("ACTIVE"))
                .andExpect(jsonPath("$.data.skill.ownerId").value("hidden-owner-" + suffix))
                .andExpect(jsonPath("$.data.skill.ownerDisplayName").value("Hidden Owner"))
                .andExpect(jsonPath("$.data.summary").value("Admin detail summary " + suffix));
    }

    @Test
    void getSkillDetail_superAdmin_readsArchivedSkillOfAnotherOwner() throws Exception {
        String suffix = uniqueSuffix();
        Namespace namespace = createNamespace(suffix);
        createOwner("archived-owner-" + suffix, "Archived Owner");
        String summary = "Admin detail summary " + suffix;
        Skill skill = createSkill(namespace, "archived", "archived-owner-" + suffix, false, SkillStatus.ARCHIVED, summary);

        mockMvc.perform(get("/api/v1/admin/skills/{skillId}", skill.getId()).with(authentication(superAdminAuth())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.skill.slug").value("admin-detail-" + suffix + "-archived"))
                .andExpect(jsonPath("$.data.skill.status").value("ARCHIVED"))
                .andExpect(jsonPath("$.data.skill.hidden").value(false))
                .andExpect(jsonPath("$.data.skill.ownerId").value("archived-owner-" + suffix))
                .andExpect(jsonPath("$.data.summary").value("Admin detail summary " + suffix));
    }

    @Test
    void getSkillDetail_unauthorizedRolesAreRejected() throws Exception {
        String suffix = uniqueSuffix();
        Namespace namespace = createNamespace(suffix);
        createOwner("plain-owner-" + suffix, "Plain Owner");
        Skill skill = createSkill(namespace, "plain", "plain-owner-" + suffix, true, SkillStatus.ACTIVE, "Admin detail summary " + suffix);

        mockMvc.perform(get("/api/v1/admin/skills/{skillId}", skill.getId()))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/v1/admin/skills/{skillId}", skill.getId()).with(authentication(plainUserAuth())))
                .andExpect(status().isForbidden());
    }

    @Test
    void getSkillDetail_unknownSkillIdIsRejected() throws Exception {
        mockMvc.perform(get("/api/v1/admin/skills/{skillId}", 9_999_999).with(authentication(superAdminAuth())))
                .andExpect(status().isBadRequest());
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

    private Skill createSkill(Namespace namespace, String marker, String ownerId, boolean hidden, SkillStatus status, String summary) {
        String slug = namespace.getSlug() + "-" + marker;

        Skill skill = new Skill(namespace.getId(), slug, ownerId, SkillVisibility.PUBLIC);
        skill.setDisplayName(namespace.getDisplayName());
        skill.setSummary(summary);
        skill.setCreatedBy(ownerId);
        skill.setUpdatedBy(ownerId);
        if (hidden) {
            skill.setHidden(true);
        }
        skill.setStatus(status);
        return skillRepository.save(skill);
    }

    private SkillVersion createVersion(Skill skill, String version, SkillVersionStatus status,
                                       String changelog, int fileCount, long totalSize) {
        SkillVersion skillVersion = new SkillVersion(skill.getId(), version, skill.getOwnerId());
        skillVersion.setStatus(status);
        skillVersion.setChangelog(changelog);
        skillVersion.setFileCount(fileCount);
        skillVersion.setTotalSize(totalSize);
        skillVersion.setPublishedAt(Instant.parse("2026-09-01T08:00:00Z"));
        return skillVersionRepository.save(skillVersion);
    }

    private Long createLabel(String slug, String displayName) {
        LabelDefinition definition = labelDefinitionRepository.save(
                new LabelDefinition(slug, LabelType.PRIVILEGED, true, 0, "test"));
        labelTranslationRepository.saveAll(List.of(new LabelTranslation(definition.getId(), "en", displayName)));
        return definition.getId();
    }

    private void attachLabel(Long skillId, Long labelId) {
        skillLabelRepository.save(new SkillLabel(skillId, labelId, "test"));
    }
}
