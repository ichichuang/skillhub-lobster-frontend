package com.iflytek.skillhub.dto;

import java.time.Instant;

/**
 * Administrator-readable summary of one skill version inside the admin skill
 * detail response. Mirrors the lifecycle data already stored on SkillVersion;
 * administrators may see non-published versions that the portal hides.
 */
public record AdminSkillVersionSummary(
        Long id,
        String version,
        String status,
        String changelog,
        Integer fileCount,
        Long totalSize,
        Instant publishedAt
) {}
