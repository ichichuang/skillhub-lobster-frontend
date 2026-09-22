package com.iflytek.skillhub.repository;

import com.iflytek.skillhub.domain.label.LabelDefinition;
import com.iflytek.skillhub.domain.label.LabelDefinitionService;
import com.iflytek.skillhub.domain.label.LabelTranslation;
import com.iflytek.skillhub.domain.label.SkillLabel;
import com.iflytek.skillhub.domain.label.SkillLabelRepository;
import com.iflytek.skillhub.domain.namespace.Namespace;
import com.iflytek.skillhub.domain.namespace.NamespaceRepository;
import com.iflytek.skillhub.domain.skill.Skill;
import com.iflytek.skillhub.domain.skill.SkillStatus;
import com.iflytek.skillhub.domain.skill.SkillVersion;
import com.iflytek.skillhub.domain.skill.SkillVersionRepository;
import com.iflytek.skillhub.domain.skill.SkillVersionStatus;
import com.iflytek.skillhub.domain.skill.service.SkillLifecycleProjectionService;
import com.iflytek.skillhub.domain.user.UserAccountRepository;
import com.iflytek.skillhub.dto.AdminSkillDetailResponse;
import com.iflytek.skillhub.dto.AdminSkillSummaryResponse;
import com.iflytek.skillhub.dto.AdminSkillVersionSummary;
import com.iflytek.skillhub.dto.SkillLabelDto;
import com.iflytek.skillhub.dto.SkillLifecycleVersionResponse;
import com.iflytek.skillhub.service.LabelLocalizationService;
import jakarta.persistence.EntityManager;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;

/**
 * Read model for the admin skill inventory.
 *
 * <p>Uses EntityManager JPQL directly because the listing needs one paged,
 * owner-unscoped query with independently optional keyword/status/hidden/label
 * filters; expressing every filter permutation on the domain repository port
 * would require a finder method per combination.
 */
@Repository
public class JpaAdminSkillQueryRepository implements AdminSkillQueryRepository {

    private final EntityManager entityManager;
    private final NamespaceRepository namespaceRepository;
    private final UserAccountRepository userAccountRepository;
    private final SkillLifecycleProjectionService skillLifecycleProjectionService;
    private final SkillLabelRepository skillLabelRepository;
    private final LabelDefinitionService labelDefinitionService;
    private final LabelLocalizationService labelLocalizationService;
    private final SkillVersionRepository skillVersionRepository;

    public JpaAdminSkillQueryRepository(EntityManager entityManager,
                                        NamespaceRepository namespaceRepository,
                                        UserAccountRepository userAccountRepository,
                                        SkillLifecycleProjectionService skillLifecycleProjectionService,
                                        SkillLabelRepository skillLabelRepository,
                                        LabelDefinitionService labelDefinitionService,
                                        LabelLocalizationService labelLocalizationService,
                                        SkillVersionRepository skillVersionRepository) {
        this.entityManager = entityManager;
        this.namespaceRepository = namespaceRepository;
        this.userAccountRepository = userAccountRepository;
        this.skillLifecycleProjectionService = skillLifecycleProjectionService;
        this.skillLabelRepository = skillLabelRepository;
        this.labelDefinitionService = labelDefinitionService;
        this.labelLocalizationService = labelLocalizationService;
        this.skillVersionRepository = skillVersionRepository;
    }

    @Override
    public Page<Skill> findSkills(String keyword, SkillStatus status, Boolean hidden, String labelSlug, Pageable pageable) {
        StringBuilder where = new StringBuilder(" WHERE 1 = 1");
        Map<String, Object> parameters = new HashMap<>();
        if (keyword != null && !keyword.isBlank()) {
            where.append(" AND (LOWER(s.slug) LIKE :keyword OR LOWER(s.displayName) LIKE :keyword)");
            parameters.put("keyword", "%" + keyword.trim().toLowerCase(Locale.ROOT) + "%");
        }
        if (status != null) {
            where.append(" AND s.status = :status");
            parameters.put("status", status);
        }
        if (hidden != null) {
            where.append(" AND s.hidden = :hidden");
            parameters.put("hidden", hidden);
        }
        if (labelSlug != null && !labelSlug.isBlank()) {
            // Matches the public search semantics: filter by label slug, case-insensitively.
            where.append(" AND EXISTS (SELECT sl FROM SkillLabel sl WHERE sl.skillId = s.id")
                    .append(" AND sl.labelId IN (SELECT ld.id FROM LabelDefinition ld WHERE LOWER(ld.slug) = :labelSlug))");
            parameters.put("labelSlug", labelSlug.trim().toLowerCase(Locale.ROOT));
        }

        var itemsQuery = entityManager.createQuery(
                "SELECT s FROM Skill s" + where + " ORDER BY s.createdAt DESC, s.id DESC", Skill.class);
        parameters.forEach(itemsQuery::setParameter);
        itemsQuery.setFirstResult((int) pageable.getOffset());
        itemsQuery.setMaxResults(pageable.getPageSize());
        List<Skill> skills = itemsQuery.getResultList();

        var countQuery = entityManager.createQuery("SELECT COUNT(s) FROM Skill s" + where, Long.class);
        parameters.forEach(countQuery::setParameter);
        long total = countQuery.getSingleResult();

        return new PageImpl<>(skills, pageable, total);
    }

    @Override
    public List<AdminSkillSummaryResponse> getSkillSummaries(List<Skill> skills) {
        if (skills.isEmpty()) {
            return List.of();
        }
        Map<Long, String> namespaceSlugsById = namespaceRepository.findByIdIn(
                        skills.stream().map(Skill::getNamespaceId).distinct().toList())
                .stream()
                .collect(Collectors.toMap(Namespace::getId, Namespace::getSlug));
        Map<String, String> ownerDisplayNamesById = userAccountRepository.findByIdIn(
                        skills.stream().map(Skill::getOwnerId).distinct().toList())
                .stream()
                .collect(Collectors.toMap(
                        owner -> owner.getId(),
                        owner -> owner.getDisplayName(),
                        (first, second) -> first));
        Map<Long, SkillLifecycleProjectionService.Projection> projectionsBySkillId = skills.stream()
                .collect(Collectors.toMap(
                        Skill::getId,
                        skillLifecycleProjectionService::projectForOwnerSummary,
                        (first, second) -> first));
        Map<Long, List<SkillLabelDto>> labelsBySkillId = loadLabelsBySkillId(
                skills.stream().map(Skill::getId).toList());

        return skills.stream()
                .map(skill -> toSummaryResponse(
                        skill,
                        namespaceSlugsById,
                        ownerDisplayNamesById,
                        projectionsBySkillId.get(skill.getId()),
                        labelsBySkillId.getOrDefault(skill.getId(), List.of())))
                .toList();
    }

    @Override
    public AdminSkillDetailResponse getSkillDetail(Skill skill) {
        AdminSkillSummaryResponse summary = getSkillSummaries(List.of(skill)).get(0);
        List<AdminSkillVersionSummary> versions = skillVersionRepository.findBySkillId(skill.getId()).stream()
                .sorted(java.util.Comparator
                        .comparing((SkillVersion version) ->
                                version.getStatus() == SkillVersionStatus.PUBLISHED ? 0 : 1)
                        .thenComparing(SkillVersion::getPublishedAt,
                                java.util.Comparator.nullsLast(java.util.Comparator.reverseOrder()))
                        .thenComparing(SkillVersion::getCreatedAt,
                                java.util.Comparator.nullsLast(java.util.Comparator.reverseOrder()))
                        .thenComparing(SkillVersion::getId, java.util.Comparator.reverseOrder()))
                .map(this::toVersionSummary)
                .toList();
        return new AdminSkillDetailResponse(summary, skill.getSummary(), versions);
    }

    private AdminSkillVersionSummary toVersionSummary(SkillVersion version) {
        return new AdminSkillVersionSummary(
                version.getId(),
                version.getVersion(),
                version.getStatus().name(),
                version.getChangelog(),
                version.getFileCount(),
                version.getTotalSize(),
                version.getPublishedAt()
        );
    }

    /**
     * Loads the labels for a whole page of skills in three batched queries
     * (skill-label links, definitions, translations) so listing never issues
     * per-skill label lookups.
     */
    private Map<Long, List<SkillLabelDto>> loadLabelsBySkillId(List<Long> skillIds) {
        List<SkillLabel> skillLabels = skillLabelRepository.findBySkillIdIn(skillIds);
        if (skillLabels.isEmpty()) {
            return Map.of();
        }
        List<Long> labelIds = skillLabels.stream()
                .map(SkillLabel::getLabelId)
                .distinct()
                .toList();
        Map<Long, LabelDefinition> definitionsById = labelDefinitionService.listByIds(labelIds).stream()
                .collect(Collectors.toMap(LabelDefinition::getId, Function.identity()));
        if (definitionsById.isEmpty()) {
            return Map.of();
        }
        Map<Long, List<LabelTranslation>> translationsByLabelId =
                labelDefinitionService.listTranslationsByLabelIds(List.copyOf(definitionsById.keySet()));

        Map<Long, List<SkillLabelDto>> labelsBySkillId = new HashMap<>();
        for (SkillLabel skillLabel : skillLabels) {
            LabelDefinition definition = definitionsById.get(skillLabel.getLabelId());
            if (definition == null) {
                continue;
            }
            SkillLabelDto dto = new SkillLabelDto(
                    definition.getSlug(),
                    definition.getType().name(),
                    labelLocalizationService.resolveDisplayName(
                            definition.getSlug(),
                            translationsByLabelId.getOrDefault(definition.getId(), List.of()))
            );
            labelsBySkillId.computeIfAbsent(skillLabel.getSkillId(), ignored -> new ArrayList<>()).add(dto);
        }
        labelsBySkillId.values().forEach(labels -> labels.sort(
                java.util.Comparator.comparing(SkillLabelDto::type).thenComparing(SkillLabelDto::slug)));
        return labelsBySkillId;
    }

    private AdminSkillSummaryResponse toSummaryResponse(
            Skill skill,
            Map<Long, String> namespaceSlugsById,
            Map<String, String> ownerDisplayNamesById,
            SkillLifecycleProjectionService.Projection projection,
            List<SkillLabelDto> labels) {
        return new AdminSkillSummaryResponse(
                skill.getId(),
                namespaceSlugsById.get(skill.getNamespaceId()),
                skill.getSlug(),
                skill.getDisplayName(),
                labels,
                skill.getOwnerId(),
                ownerDisplayNamesById.get(skill.getOwnerId()),
                skill.getVisibility().name(),
                skill.getStatus().name(),
                skill.isHidden(),
                skill.getCreatedAt(),
                skill.getUpdatedAt(),
                toLifecycleVersion(projection.headlineVersion()),
                toLifecycleVersion(projection.publishedVersion()),
                toLifecycleVersion(projection.ownerPreviewVersion()),
                projection.resolutionMode().name()
        );
    }

    private SkillLifecycleVersionResponse toLifecycleVersion(
            SkillLifecycleProjectionService.VersionProjection projection) {
        if (projection == null) {
            return null;
        }
        return new SkillLifecycleVersionResponse(projection.id(), projection.version(), projection.status());
    }
}
