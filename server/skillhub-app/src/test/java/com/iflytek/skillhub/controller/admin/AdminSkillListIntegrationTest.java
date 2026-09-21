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

import static org.hamcrest.Matchers.nullValue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Proves the admin skill inventory returns skills across all owners in every
 * state — including hidden and version-less skills that public listing
 * endpoints structurally exclude.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(TestRedisConfig.class)
class AdminSkillListIntegrationTest {

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
    void listSkills_superAdmin_seesCrossOwnerSkillsIncludingHiddenWithOwnerFields() throws Exception {
        String suffix = uniqueSuffix();
        Namespace namespace = createNamespace(suffix);
        createOwner("owner-a-" + suffix, "Owner A");
        createOwner("owner-b-" + suffix, "Owner B");
        String slugVisible = createSkill(namespace, "visible", "owner-a-" + suffix, false, true);
        String slugHidden = createSkill(namespace, "hidden", "owner-b-" + suffix, true, false);

        mockMvc.perform(get("/api/v1/admin/skills").param("q", slugVisible).with(authentication(superAdminAuth())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.items[0].id").isNumber())
                .andExpect(jsonPath("$.data.items[0].namespace").value("admin-list-" + suffix))
                .andExpect(jsonPath("$.data.items[0].slug").value(slugVisible))
                .andExpect(jsonPath("$.data.items[0].displayName").value("Admin List " + suffix))
                .andExpect(jsonPath("$.data.items[0].ownerId").value("owner-a-" + suffix))
                .andExpect(jsonPath("$.data.items[0].ownerDisplayName").value("Owner A"))
                .andExpect(jsonPath("$.data.items[0].visibility").value("PUBLIC"))
                .andExpect(jsonPath("$.data.items[0].status").value("ACTIVE"))
                .andExpect(jsonPath("$.data.items[0].hidden").value(false))
                .andExpect(jsonPath("$.data.items[0].createdAt").isNotEmpty())
                .andExpect(jsonPath("$.data.items[0].updatedAt").isNotEmpty())
                .andExpect(jsonPath("$.data.items[0].headlineVersion.version").value("1.0.0"))
                .andExpect(jsonPath("$.data.items[0].publishedVersion.status").value("PUBLISHED"))
                .andExpect(jsonPath("$.data.items[0].resolutionMode").value("PUBLISHED"));

        mockMvc.perform(get("/api/v1/admin/skills").param("q", slugHidden).with(authentication(superAdminAuth())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.items[0].slug").value(slugHidden))
                .andExpect(jsonPath("$.data.items[0].ownerId").value("owner-b-" + suffix))
                .andExpect(jsonPath("$.data.items[0].ownerDisplayName").value("Owner B"))
                .andExpect(jsonPath("$.data.items[0].status").value("ACTIVE"))
                .andExpect(jsonPath("$.data.items[0].hidden").value(true))
                .andExpect(jsonPath("$.data.items[0].publishedVersion").value(nullValue()));
    }

    @Test
    void listSkills_paginationSplitsResultsWithoutOwnerScoping() throws Exception {
        String suffix = uniqueSuffix();
        Namespace namespace = createNamespace(suffix);
        createOwner("owner-a-" + suffix, "Owner A");
        createOwner("owner-b-" + suffix, "Owner B");
        String slugFirst = createSkill(namespace, "page1", "owner-a-" + suffix, false, false);
        createSkill(namespace, "page2", "owner-b-" + suffix, true, false);
        createSkill(namespace, "page3", "owner-a-" + suffix, false, false);

        mockMvc.perform(get("/api/v1/admin/skills")
                        .param("q", "admin-list-" + suffix)
                        .param("page", "0")
                        .param("size", "2")
                        .with(authentication(superAdminAuth())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(3))
                .andExpect(jsonPath("$.data.page").value(0))
                .andExpect(jsonPath("$.data.size").value(2))
                .andExpect(jsonPath("$.data.items.length()").value(2));

        // Fixed ordering (createdAt DESC, id DESC) makes the trailing page deterministic.
        mockMvc.perform(get("/api/v1/admin/skills")
                        .param("q", "admin-list-" + suffix)
                        .param("page", "1")
                        .param("size", "2")
                        .with(authentication(superAdminAuth())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(3))
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].slug").value(slugFirst));
    }

    @Test
    void listSkills_hiddenFilter_returnsOnlyMatchingState() throws Exception {
        String suffix = uniqueSuffix();
        Namespace namespace = createNamespace(suffix);
        createOwner("owner-a-" + suffix, "Owner A");
        createOwner("owner-b-" + suffix, "Owner B");
        createSkill(namespace, "keep", "owner-a-" + suffix, false, false);
        String slugHidden = createSkill(namespace, "gone", "owner-b-" + suffix, true, false);

        mockMvc.perform(get("/api/v1/admin/skills")
                        .param("q", "admin-list-" + suffix)
                        .param("hidden", "true")
                        .with(authentication(superAdminAuth())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.items[0].slug").value(slugHidden))
                .andExpect(jsonPath("$.data.items[0].hidden").value(true));

        mockMvc.perform(get("/api/v1/admin/skills")
                        .param("q", "admin-list-" + suffix)
                        .param("hidden", "false")
                        .with(authentication(superAdminAuth())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.items[0].hidden").value(false));
    }

    @Test
    void listSkills_unauthenticated_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/admin/skills"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(401));
    }

    @Test
    void listSkills_returnsAssignedLabelsAndEmptyCollectionForUnlabeledSkills() throws Exception {
        String suffix = uniqueSuffix();
        Namespace namespace = createNamespace(suffix);
        createOwner("owner-a-" + suffix, "Owner A");
        Long labelId = createLabel("official-" + suffix, "Official " + suffix);
        String slugLabeled = createSkill(namespace, "labeled", "owner-a-" + suffix, false, false);
        String slugUnlabeled = createSkill(namespace, "unlabeled", "owner-a-" + suffix, false, false);
        attachLabel(resolveSkillId(namespace, "labeled"), labelId);

        // Fixed ordering (createdAt DESC, id DESC) puts the later unlabeled skill first.
        mockMvc.perform(get("/api/v1/admin/skills")
                        .param("q", "admin-list-" + suffix)
                        .with(authentication(superAdminAuth())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(2))
                .andExpect(jsonPath("$.data.items[0].slug").value(slugUnlabeled))
                .andExpect(jsonPath("$.data.items[0].labels.length()").value(0))
                .andExpect(jsonPath("$.data.items[1].slug").value(slugLabeled))
                .andExpect(jsonPath("$.data.items[1].labels.length()").value(1))
                .andExpect(jsonPath("$.data.items[1].labels[0].slug").value("official-" + suffix))
                .andExpect(jsonPath("$.data.items[1].labels[0].type").value("PRIVILEGED"))
                .andExpect(jsonPath("$.data.items[1].labels[0].displayName").value("Official " + suffix));
    }

    @Test
    void listSkills_labelFilterMatchesAcrossOwnersAndIncludesEligibleHiddenSkills() throws Exception {
        String suffix = uniqueSuffix();
        Namespace namespace = createNamespace(suffix);
        createOwner("owner-a-" + suffix, "Owner A");
        createOwner("owner-b-" + suffix, "Owner B");
        Long sharedLabelId = createLabel("shared-" + suffix, "Shared " + suffix);
        Long otherLabelId = createLabel("other-" + suffix, "Other " + suffix);
        String slugVisibleShared = createSkill(namespace, "vis-shared", "owner-a-" + suffix, false, false);
        String slugHiddenShared = createSkill(namespace, "hid-shared", "owner-b-" + suffix, true, false);
        String slugOther = createSkill(namespace, "other", "owner-a-" + suffix, false, false);
        attachLabel(resolveSkillId(namespace, "vis-shared"), sharedLabelId);
        attachLabel(resolveSkillId(namespace, "hid-shared"), sharedLabelId);
        attachLabel(resolveSkillId(namespace, "other"), otherLabelId);

        mockMvc.perform(get("/api/v1/admin/skills")
                        .param("q", "admin-list-" + suffix)
                        .param("label", "shared-" + suffix)
                        .with(authentication(superAdminAuth())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(2))
                .andExpect(jsonPath("$.data.items.length()").value(2))
                .andExpect(jsonPath("$.data.items[?(@.slug == '" + slugVisibleShared + "')].hidden").value(false))
                .andExpect(jsonPath("$.data.items[?(@.slug == '" + slugHiddenShared + "')].hidden").value(true));

        mockMvc.perform(get("/api/v1/admin/skills")
                        .param("q", "admin-list-" + suffix)
                        .param("label", "OTHER-" + suffix.toUpperCase())
                        .with(authentication(superAdminAuth())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.items[0].slug").value(slugOther));
    }

    @Test
    void listSkills_labelFilterKeepsPaginationTotalsCorrect() throws Exception {
        String suffix = uniqueSuffix();
        Namespace namespace = createNamespace(suffix);
        createOwner("owner-a-" + suffix, "Owner A");
        Long labelId = createLabel("paged-" + suffix, "Paged " + suffix);
        createSkill(namespace, "p1", "owner-a-" + suffix, false, false);
        createSkill(namespace, "p2", "owner-a-" + suffix, false, false);
        createSkill(namespace, "p3", "owner-a-" + suffix, false, false);
        attachLabel(resolveSkillId(namespace, "p1"), labelId);
        attachLabel(resolveSkillId(namespace, "p2"), labelId);
        attachLabel(resolveSkillId(namespace, "p3"), labelId);

        mockMvc.perform(get("/api/v1/admin/skills")
                        .param("q", "admin-list-" + suffix)
                        .param("label", "paged-" + suffix)
                        .param("page", "0")
                        .param("size", "2")
                        .with(authentication(superAdminAuth())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(3))
                .andExpect(jsonPath("$.data.items.length()").value(2));

        mockMvc.perform(get("/api/v1/admin/skills")
                        .param("q", "admin-list-" + suffix)
                        .param("label", "paged-" + suffix)
                        .param("page", "1")
                        .param("size", "2")
                        .with(authentication(superAdminAuth())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(3))
                .andExpect(jsonPath("$.data.items.length()").value(1));
    }

    @Test
    void listSkills_labelFilterComposesWithHiddenAndStatusFilters() throws Exception {
        String suffix = uniqueSuffix();
        Namespace namespace = createNamespace(suffix);
        createOwner("owner-a-" + suffix, "Owner A");
        Long labelId = createLabel("combo-" + suffix, "Combo " + suffix);
        createSkill(namespace, "combo-visible", "owner-a-" + suffix, false, false);
        String slugHiddenLabeled = createSkill(namespace, "combo-hidden", "owner-a-" + suffix, true, false);
        attachLabel(resolveSkillId(namespace, "combo-visible"), labelId);
        attachLabel(resolveSkillId(namespace, "combo-hidden"), labelId);

        mockMvc.perform(get("/api/v1/admin/skills")
                        .param("q", "admin-list-" + suffix)
                        .param("label", "combo-" + suffix)
                        .param("hidden", "true")
                        .with(authentication(superAdminAuth())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.items[0].slug").value(slugHiddenLabeled))
                .andExpect(jsonPath("$.data.items[0].labels[0].slug").value("combo-" + suffix));
    }

    private Long createLabel(String slug, String displayName) {
        LabelDefinition definition = labelDefinitionRepository.save(
                new LabelDefinition(slug, LabelType.PRIVILEGED, true, 0, "test"));
        // Only an "en" translation is deterministic regardless of the JVM locale.
        labelTranslationRepository.saveAll(List.of(new LabelTranslation(definition.getId(), "en", displayName)));
        return definition.getId();
    }

    private Long resolveSkillId(Namespace namespace, String marker) {
        return skillRepository.findByNamespaceIdAndSlug(namespace.getId(), namespace.getSlug() + "-" + marker)
                .stream()
                .findFirst()
                .orElseThrow()
                .getId();
    }

    private void attachLabel(Long skillId, Long labelId) {
        skillLabelRepository.save(new SkillLabel(skillId, labelId, "test"));
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
                new Namespace("admin-list-" + suffix, "Admin List " + suffix, "system"));
    }

    private String createSkill(Namespace namespace, String marker, String ownerId, boolean hidden, boolean withPublishedVersion) {
        String slug = namespace.getSlug() + "-" + marker;

        Skill skill = new Skill(namespace.getId(), slug, ownerId, SkillVisibility.PUBLIC);
        skill.setDisplayName(namespace.getDisplayName());
        skill.setCreatedBy(ownerId);
        skill.setUpdatedBy(ownerId);
        if (hidden) {
            skill.setHidden(true);
        }
        skill = skillRepository.save(skill);
        skillRepository.flush();

        if (withPublishedVersion) {
            SkillVersion version = new SkillVersion(skill.getId(), "1.0.0", ownerId);
            version.setStatus(SkillVersionStatus.PUBLISHED);
            version = skillVersionRepository.save(version);
            skillVersionRepository.flush();

            skill.setLatestVersionId(version.getId());
            skillRepository.save(skill);
            skillRepository.flush();
        }
        return slug;
    }
}
