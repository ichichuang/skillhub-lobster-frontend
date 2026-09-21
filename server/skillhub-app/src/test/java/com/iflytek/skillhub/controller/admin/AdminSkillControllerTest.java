package com.iflytek.skillhub.controller.admin;

import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.iflytek.skillhub.auth.device.DeviceAuthService;
import com.iflytek.skillhub.auth.rbac.PlatformPrincipal;
import com.iflytek.skillhub.domain.namespace.NamespaceMemberRepository;
import com.iflytek.skillhub.domain.skill.Skill;
import com.iflytek.skillhub.domain.skill.SkillVersion;
import com.iflytek.skillhub.domain.skill.SkillVisibility;
import com.iflytek.skillhub.domain.skill.SkillVersionStatus;
import com.iflytek.skillhub.domain.skill.service.SkillGovernanceService;
import com.iflytek.skillhub.dto.AdminSkillSummaryResponse;
import com.iflytek.skillhub.dto.PageResponse;
import com.iflytek.skillhub.dto.SkillLifecycleVersionResponse;
import com.iflytek.skillhub.service.AdminSkillAppService;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AdminSkillControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private SkillGovernanceService skillGovernanceService;

    @MockBean
    private NamespaceMemberRepository namespaceMemberRepository;

    @MockBean
    private DeviceAuthService deviceAuthService;

    @MockBean
    private AdminSkillAppService adminSkillAppService;

    @Test
    void listSkills_withSuperAdminRole_returnsCrossOwnerInventoryIncludingHidden() throws Exception {
        PlatformPrincipal principal = new PlatformPrincipal("admin", "admin", "a@example.com", "", "github", Set.of("SUPER_ADMIN"));
        var auth = new UsernamePasswordAuthenticationToken(principal, null, List.of(new SimpleGrantedAuthority("ROLE_SUPER_ADMIN")));

        var visibleSkill = new AdminSkillSummaryResponse(
                10L, "team-a", "demo-visible", "Demo Visible",
                List.of(new com.iflytek.skillhub.dto.SkillLabelDto("official", "PRIVILEGED", "Official")),
                "owner-1", "Owner One",
                "PUBLIC", "ACTIVE", false,
                Instant.parse("2026-03-13T09:00:00Z"), Instant.parse("2026-03-13T10:00:00Z"),
                new SkillLifecycleVersionResponse(101L, "1.0.0", "PUBLISHED"),
                new SkillLifecycleVersionResponse(101L, "1.0.0", "PUBLISHED"),
                null,
                "PUBLISHED");
        var hiddenSkill = new AdminSkillSummaryResponse(
                11L, "team-b", "demo-hidden", "Demo Hidden",
                List.of(),
                "owner-2", "Owner Two",
                "PUBLIC", "ACTIVE", true,
                Instant.parse("2026-03-13T08:00:00Z"), Instant.parse("2026-03-13T09:30:00Z"),
                null, null, null,
                "NONE");
        given(adminSkillAppService.listSkills(null, null, null, null, 0, 20))
                .willReturn(new PageResponse<>(List.of(visibleSkill, hiddenSkill), 2, 0, 20));

        mockMvc.perform(get("/api/v1/admin/skills").with(authentication(auth)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(0))
            .andExpect(jsonPath("$.data.total").value(2))
            .andExpect(jsonPath("$.data.items[0].id").value(10))
            .andExpect(jsonPath("$.data.items[0].namespace").value("team-a"))
            .andExpect(jsonPath("$.data.items[0].slug").value("demo-visible"))
            .andExpect(jsonPath("$.data.items[0].ownerId").value("owner-1"))
            .andExpect(jsonPath("$.data.items[0].ownerDisplayName").value("Owner One"))
            .andExpect(jsonPath("$.data.items[0].status").value("ACTIVE"))
            .andExpect(jsonPath("$.data.items[0].hidden").value(false))
            .andExpect(jsonPath("$.data.items[0].visibility").value("PUBLIC"))
            .andExpect(jsonPath("$.data.items[0].createdAt").value("2026-03-13T09:00:00Z"))
            .andExpect(jsonPath("$.data.items[0].publishedVersion.version").value("1.0.0"))
            .andExpect(jsonPath("$.data.items[1].ownerId").value("owner-2"))
            .andExpect(jsonPath("$.data.items[1].hidden").value(true))
            .andExpect(jsonPath("$.data.items[1].status").value("ACTIVE"));
    }

    @Test
    void listSkills_passesFiltersAndPagingToAppService() throws Exception {
        PlatformPrincipal principal = new PlatformPrincipal("admin", "admin", "a@example.com", "", "github", Set.of("SUPER_ADMIN"));
        var auth = new UsernamePasswordAuthenticationToken(principal, null, List.of(new SimpleGrantedAuthority("ROLE_SUPER_ADMIN")));

        given(adminSkillAppService.listSkills("demo", "ARCHIVED", true, "official", 2, 5))
                .willReturn(new PageResponse<>(List.of(), 0, 2, 5));

        mockMvc.perform(get("/api/v1/admin/skills")
                        .with(authentication(auth))
                        .param("q", "demo")
                        .param("status", "ARCHIVED")
                        .param("hidden", "true")
                        .param("label", "official")
                        .param("page", "2")
                        .param("size", "5"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(0));

        verify(adminSkillAppService).listSkills("demo", "ARCHIVED", true, "official", 2, 5);
    }

    @Test
    void listSkills_labelResponseIncludesAssignedLabels() throws Exception {
        PlatformPrincipal principal = new PlatformPrincipal("admin", "admin", "a@example.com", "", "github", Set.of("SUPER_ADMIN"));
        var auth = new UsernamePasswordAuthenticationToken(principal, null, List.of(new SimpleGrantedAuthority("ROLE_SUPER_ADMIN")));

        var labeledSkill = new AdminSkillSummaryResponse(
                12L, "team-a", "demo-labeled", "Demo Labeled",
                List.of(
                        new com.iflytek.skillhub.dto.SkillLabelDto("code-generation", "RECOMMENDED", "Code Generation"),
                        new com.iflytek.skillhub.dto.SkillLabelDto("official", "PRIVILEGED", "Official")),
                "owner-1", "Owner One",
                "PUBLIC", "ACTIVE", false,
                Instant.parse("2026-03-13T09:00:00Z"), Instant.parse("2026-03-13T10:00:00Z"),
                null, null, null,
                "NONE");
        given(adminSkillAppService.listSkills(null, null, null, null, 0, 20))
                .willReturn(new PageResponse<>(List.of(labeledSkill), 1, 0, 20));

        mockMvc.perform(get("/api/v1/admin/skills").with(authentication(auth)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.items[0].labels.length()").value(2))
            .andExpect(jsonPath("$.data.items[0].labels[0].slug").value("code-generation"))
            .andExpect(jsonPath("$.data.items[0].labels[0].type").value("RECOMMENDED"))
            .andExpect(jsonPath("$.data.items[0].labels[0].displayName").value("Code Generation"))
            .andExpect(jsonPath("$.data.items[0].labels[1].slug").value("official"));
    }

    @Test
    void listSkills_unauthenticated_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/admin/skills"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value(401));
    }

    @Test
    void listSkills_withUserAdminRole_returns403() throws Exception {
        PlatformPrincipal principal = new PlatformPrincipal("admin", "admin", "a@example.com", "", "github", Set.of("USER_ADMIN"));
        var auth = new UsernamePasswordAuthenticationToken(principal, null, List.of(new SimpleGrantedAuthority("ROLE_USER_ADMIN")));

        mockMvc.perform(get("/api/v1/admin/skills").with(authentication(auth)))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value(403));
    }

    @Test
    void listSkills_withSkillAdminRole_returns403() throws Exception {
        PlatformPrincipal principal = new PlatformPrincipal("admin", "admin", "a@example.com", "", "github", Set.of("SKILL_ADMIN"));
        var auth = new UsernamePasswordAuthenticationToken(principal, null, List.of(new SimpleGrantedAuthority("ROLE_SKILL_ADMIN")));

        mockMvc.perform(get("/api/v1/admin/skills").with(authentication(auth)))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value(403));
    }

    @Test
    void hideSkill_returnsUpdatedResponse() throws Exception {
        Skill skill = new Skill(1L, "demo", "owner", SkillVisibility.PUBLIC);
        given(skillGovernanceService.hideSkill(org.mockito.ArgumentMatchers.eq(10L), org.mockito.ArgumentMatchers.eq("admin"), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.eq("policy")))
            .willReturn(skill);

        PlatformPrincipal principal = new PlatformPrincipal("admin", "admin", "a@example.com", "", "github", Set.of("SUPER_ADMIN"));
        var auth = new UsernamePasswordAuthenticationToken(principal, null, List.of(new SimpleGrantedAuthority("ROLE_SUPER_ADMIN")));

        mockMvc.perform(post("/api/v1/admin/skills/10/hide")
                .with(authentication(auth))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\":\"policy\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(0))
            .andExpect(jsonPath("$.data.skillId").value(10))
            .andExpect(jsonPath("$.data.action").value("HIDE"));
    }

    @Test
    void yankVersion_returnsUpdatedResponse() throws Exception {
        SkillVersion version = new SkillVersion(10L, "1.0.0", "owner");
        version.setStatus(SkillVersionStatus.YANKED);
        given(skillGovernanceService.yankVersion(org.mockito.ArgumentMatchers.eq(33L), org.mockito.ArgumentMatchers.eq("admin"), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.eq("broken")))
            .willReturn(version);

        PlatformPrincipal principal = new PlatformPrincipal("admin", "admin", "a@example.com", "", "github", Set.of("SKILL_ADMIN"));
        var auth = new UsernamePasswordAuthenticationToken(principal, null, List.of(new SimpleGrantedAuthority("ROLE_SKILL_ADMIN")));

        mockMvc.perform(post("/api/v1/admin/skills/versions/33/yank")
                .with(authentication(auth))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\":\"broken\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(0))
            .andExpect(jsonPath("$.data.versionId").value(33))
            .andExpect(jsonPath("$.data.action").value("YANK"))
            .andExpect(jsonPath("$.data.status").value("YANKED"));
    }

    @Test
    void hideSkill_withUserAdminRole_returns403() throws Exception {
        PlatformPrincipal principal = new PlatformPrincipal("admin", "admin", "a@example.com", "", "github", Set.of("USER_ADMIN"));
        var auth = new UsernamePasswordAuthenticationToken(principal, null, List.of(new SimpleGrantedAuthority("ROLE_USER_ADMIN")));

        mockMvc.perform(post("/api/v1/admin/skills/10/hide")
                .with(authentication(auth))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\":\"policy\"}"))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value(403));
    }

    @Test
    void hideSkill_withSkillAdminRole_returns403() throws Exception {
        PlatformPrincipal principal = new PlatformPrincipal("admin", "admin", "a@example.com", "", "github", Set.of("SKILL_ADMIN"));
        var auth = new UsernamePasswordAuthenticationToken(principal, null, List.of(new SimpleGrantedAuthority("ROLE_SKILL_ADMIN")));

        mockMvc.perform(post("/api/v1/admin/skills/10/hide")
                .with(authentication(auth))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\":\"policy\"}"))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value(403));
    }
}
