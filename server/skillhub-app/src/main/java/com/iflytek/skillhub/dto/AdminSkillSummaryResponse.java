package com.iflytek.skillhub.dto;

import java.time.Instant;
import java.util.List;

/**
 * Admin-facing skill inventory row. Unlike public skill summaries this
 * includes owner identity and the hidden governance overlay so platform
 * administrators can audit and manage every skill regardless of state.
 */
public record AdminSkillSummaryResponse(
        Long id,
        String namespace,
        String slug,
        String displayName,
        List<SkillLabelDto> labels,
        String ownerId,
        String ownerDisplayName,
        String visibility,
        String status,
        boolean hidden,
        Instant createdAt,
        Instant updatedAt,
        SkillLifecycleVersionResponse headlineVersion,
        SkillLifecycleVersionResponse publishedVersion,
        SkillLifecycleVersionResponse ownerPreviewVersion,
        String resolutionMode
) {}
