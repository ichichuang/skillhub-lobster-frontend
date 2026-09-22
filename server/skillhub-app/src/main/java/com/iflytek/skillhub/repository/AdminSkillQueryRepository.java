package com.iflytek.skillhub.repository;

import com.iflytek.skillhub.domain.skill.Skill;
import com.iflytek.skillhub.domain.skill.SkillStatus;
import com.iflytek.skillhub.dto.AdminSkillDetailResponse;
import com.iflytek.skillhub.dto.AdminSkillSummaryResponse;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

/**
 * Query-side repository for the platform-admin skill inventory. Returns every
 * skill across all owners and lifecycle states, including hidden ones.
 */
public interface AdminSkillQueryRepository {

    Page<Skill> findSkills(String keyword, SkillStatus status, Boolean hidden, String labelSlug, Pageable pageable);

    List<AdminSkillSummaryResponse> getSkillSummaries(List<Skill> skills);

    AdminSkillDetailResponse getSkillDetail(Skill skill);
}
