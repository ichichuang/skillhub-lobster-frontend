package com.iflytek.skillhub.controller.admin;

import com.iflytek.skillhub.auth.rbac.PlatformPrincipal;
import com.iflytek.skillhub.controller.BaseApiController;
import com.iflytek.skillhub.dto.AdminSkillActionRequest;
import com.iflytek.skillhub.dto.AdminSkillDetailResponse;
import com.iflytek.skillhub.dto.AdminSkillMutationResponse;
import com.iflytek.skillhub.dto.AdminSkillSummaryResponse;
import com.iflytek.skillhub.dto.ApiResponse;
import com.iflytek.skillhub.dto.ApiResponseFactory;
import com.iflytek.skillhub.dto.PageResponse;
import com.iflytek.skillhub.dto.SkillFileResponse;
import com.iflytek.skillhub.domain.skill.service.SkillGovernanceService;
import com.iflytek.skillhub.service.AdminSkillAppService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Administrative skill endpoints: platform-wide skill inventory reads and
 * governance mutations such as hide and unhide.
 */
@RestController
@RequestMapping("/api/v1/admin/skills")
public class AdminSkillController extends BaseApiController {

    private final SkillGovernanceService skillGovernanceService;
    private final AdminSkillAppService adminSkillAppService;

    public AdminSkillController(ApiResponseFactory responseFactory,
                                SkillGovernanceService skillGovernanceService,
                                AdminSkillAppService adminSkillAppService) {
        super(responseFactory);
        this.skillGovernanceService = skillGovernanceService;
        this.adminSkillAppService = adminSkillAppService;
    }

    @GetMapping
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ApiResponse<PageResponse<AdminSkillSummaryResponse>> listSkills(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Boolean hidden,
            @RequestParam(required = false) String label,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ok("response.success.read", adminSkillAppService.listSkills(q, status, hidden, label, page, size));
    }

    @GetMapping("/{skillId}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ApiResponse<AdminSkillDetailResponse> getSkillDetail(@PathVariable Long skillId) {
        return ok("response.success.read", adminSkillAppService.getSkillDetail(skillId));
    }

    @GetMapping("/{skillId}/versions/{versionId}/files")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ApiResponse<List<SkillFileResponse>> listVersionFiles(@PathVariable Long skillId,
                                                                 @PathVariable Long versionId) {
        return ok("response.success.read", adminSkillAppService.listVersionFiles(skillId, versionId));
    }

    @PostMapping("/{skillId}/hide")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ApiResponse<AdminSkillMutationResponse> hideSkill(@PathVariable Long skillId,
                                                             @RequestBody(required = false) AdminSkillActionRequest request,
                                                             @AuthenticationPrincipal PlatformPrincipal principal,
                                                             HttpServletRequest httpRequest) {
        var skill = skillGovernanceService.hideSkill(
            skillId,
            principal.userId(),
            httpRequest.getRemoteAddr(),
            httpRequest.getHeader("User-Agent"),
            request != null ? request.reason() : null
        );
        return ok("response.success.updated", new AdminSkillMutationResponse(skillId, null, "HIDE", skill.getStatus().name()));
    }

    @PostMapping("/{skillId}/unhide")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ApiResponse<AdminSkillMutationResponse> unhideSkill(@PathVariable Long skillId,
                                                               @AuthenticationPrincipal PlatformPrincipal principal,
                                                               HttpServletRequest httpRequest) {
        var skill = skillGovernanceService.unhideSkill(
            skillId,
            principal.userId(),
            httpRequest.getRemoteAddr(),
            httpRequest.getHeader("User-Agent")
        );
        return ok("response.success.updated", new AdminSkillMutationResponse(skillId, null, "UNHIDE", skill.getStatus().name()));
    }

    @PostMapping("/versions/{versionId}/yank")
    @PreAuthorize("hasAnyRole('SKILL_ADMIN', 'SUPER_ADMIN')")
    public ApiResponse<AdminSkillMutationResponse> yankVersion(@PathVariable Long versionId,
                                                               @RequestBody(required = false) AdminSkillActionRequest request,
                                                               @AuthenticationPrincipal PlatformPrincipal principal,
                                                               HttpServletRequest httpRequest) {
        var version = skillGovernanceService.yankVersion(
            versionId,
            principal.userId(),
            httpRequest.getRemoteAddr(),
            httpRequest.getHeader("User-Agent"),
            request != null ? request.reason() : null
        );
        return ok("response.success.updated", new AdminSkillMutationResponse(version.getSkillId(), versionId, "YANK", version.getStatus().name()));
    }
}
