package com.iflytek.skillhub.service;

import com.iflytek.skillhub.domain.shared.exception.DomainBadRequestException;
import com.iflytek.skillhub.domain.skill.Skill;
import com.iflytek.skillhub.domain.skill.SkillFileRepository;
import com.iflytek.skillhub.domain.skill.SkillRepository;
import com.iflytek.skillhub.domain.skill.SkillStatus;
import com.iflytek.skillhub.domain.skill.SkillVersion;
import com.iflytek.skillhub.domain.skill.SkillVersionRepository;
import com.iflytek.skillhub.dto.AdminSkillDetailResponse;
import com.iflytek.skillhub.dto.AdminSkillSummaryResponse;
import com.iflytek.skillhub.dto.PageResponse;
import com.iflytek.skillhub.dto.SkillFileResponse;
import com.iflytek.skillhub.repository.AdminSkillQueryRepository;
import java.util.List;
import java.util.Locale;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

/**
 * Application service that serves the platform-admin skill inventory with
 * pagination and narrow keyword/status/hidden filters, plus the owner-unscoped
 * detail and version-file reads that back the admin skill detail modal.
 */
@Service
public class AdminSkillAppService {

    private final AdminSkillQueryRepository adminSkillQueryRepository;
    private final SkillRepository skillRepository;
    private final SkillVersionRepository skillVersionRepository;
    private final SkillFileRepository skillFileRepository;

    public AdminSkillAppService(AdminSkillQueryRepository adminSkillQueryRepository,
                                SkillRepository skillRepository,
                                SkillVersionRepository skillVersionRepository,
                                SkillFileRepository skillFileRepository) {
        this.adminSkillQueryRepository = adminSkillQueryRepository;
        this.skillRepository = skillRepository;
        this.skillVersionRepository = skillVersionRepository;
        this.skillFileRepository = skillFileRepository;
    }

    public PageResponse<AdminSkillSummaryResponse> listSkills(String keyword,
                                                              String status,
                                                              Boolean hidden,
                                                              String label,
                                                              int page,
                                                              int size) {
        SkillStatus resolvedStatus = parseStatus(status);
        String resolvedLabel = label == null || label.isBlank() ? null : label.trim();
        Page<Skill> skillPage = adminSkillQueryRepository.findSkills(keyword, resolvedStatus, hidden, resolvedLabel, PageRequest.of(page, size));
        List<AdminSkillSummaryResponse> items = adminSkillQueryRepository.getSkillSummaries(skillPage.getContent());

        return new PageResponse<>(items, skillPage.getTotalElements(), skillPage.getNumber(), skillPage.getSize());
    }

    /**
     * Owner-unscoped detail read for platform administrators: unlike the
     * portal detail endpoint this never applies viewer visibility rules, so
     * hidden and archived skills of any owner resolve for SUPER_ADMIN.
     */
    public AdminSkillDetailResponse getSkillDetail(Long skillId) {
        Skill skill = skillRepository.findById(skillId)
                .orElseThrow(() -> new DomainBadRequestException("error.skill.notFound", skillId));
        return adminSkillQueryRepository.getSkillDetail(skill);
    }

    /**
     * Administrator read of the packaged file metadata for one concrete
     * version. Reads the SkillFile domain repository directly instead of
     * SkillQueryService.listFiles so portal viewer-visibility rules stay
     * untouched; the only cross-check required is that the version belongs
     * to the skill addressed in the URL.
     */
    public List<SkillFileResponse> listVersionFiles(Long skillId, Long versionId) {
        Skill skill = skillRepository.findById(skillId)
                .orElseThrow(() -> new DomainBadRequestException("error.skill.notFound", skillId));
        SkillVersion version = skillVersionRepository.findById(versionId)
                .orElseThrow(() -> new DomainBadRequestException("error.skill.version.notFound", versionId));
        if (!version.getSkillId().equals(skill.getId())) {
            throw new DomainBadRequestException("error.skill.version.notFound", versionId);
        }
        return skillFileRepository.findByVersionId(versionId).stream()
                .map(file -> new SkillFileResponse(
                        file.getId(),
                        file.getFilePath(),
                        file.getFileSize(),
                        file.getContentType(),
                        file.getSha256()
                ))
                .toList();
    }

    private SkillStatus parseStatus(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        try {
            return SkillStatus.valueOf(status.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new DomainBadRequestException("error.skill.status.invalid", status);
        }
    }
}
