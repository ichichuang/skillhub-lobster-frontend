package com.iflytek.skillhub.dto;

import java.util.List;

/**
 * Administrator-readable detail for one skill regardless of owner, visibility,
 * lifecycle status, or the hidden governance overlay. Composes the inventory
 * row with the skill summary text and the full version history so a platform
 * administrator can understand what a skill does without portal visibility.
 */
public record AdminSkillDetailResponse(
        AdminSkillSummaryResponse skill,
        String summary,
        List<AdminSkillVersionSummary> versions
) {}
