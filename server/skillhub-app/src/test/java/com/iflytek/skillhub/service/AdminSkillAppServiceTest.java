package com.iflytek.skillhub.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.when;

import com.iflytek.skillhub.domain.shared.exception.DomainBadRequestException;
import com.iflytek.skillhub.domain.shared.exception.DomainNotFoundException;
import com.iflytek.skillhub.domain.skill.Skill;
import com.iflytek.skillhub.domain.skill.SkillFile;
import com.iflytek.skillhub.domain.skill.SkillFileRepository;
import com.iflytek.skillhub.domain.skill.SkillRepository;
import com.iflytek.skillhub.domain.skill.SkillStatus;
import com.iflytek.skillhub.domain.skill.SkillVersion;
import com.iflytek.skillhub.domain.skill.SkillVersionRepository;
import com.iflytek.skillhub.domain.skill.SkillVisibility;
import com.iflytek.skillhub.dto.AdminSkillDetailResponse;
import com.iflytek.skillhub.dto.AdminSkillSummaryResponse;
import com.iflytek.skillhub.dto.PageResponse;
import com.iflytek.skillhub.dto.SkillFileResponse;
import com.iflytek.skillhub.repository.AdminSkillQueryRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

@ExtendWith(MockitoExtension.class)
class AdminSkillAppServiceTest {

    @Mock
    private AdminSkillQueryRepository adminSkillQueryRepository;

    @Mock
    private SkillRepository skillRepository;

    @Mock
    private SkillVersionRepository skillVersionRepository;

    @Mock
    private SkillFileRepository skillFileRepository;

    private AdminSkillAppService service;

    @BeforeEach
    void setUp() {
        service = new AdminSkillAppService(
                adminSkillQueryRepository,
                skillRepository,
                skillVersionRepository,
                skillFileRepository
        );
    }

    @Test
    void listSkills_parsesStatusAndDelegatesWithPageRequest() {
        Skill skill = createSkill(10L);
        when(adminSkillQueryRepository.findSkills(
                eq("demo"), eq(SkillStatus.ACTIVE), eq(Boolean.TRUE), eq("official"), eq(PageRequest.of(0, 20))))
                .thenReturn(new PageImpl<>(List.of(skill), PageRequest.of(0, 20), 1));
        when(adminSkillQueryRepository.getSkillSummaries(List.of(skill)))
                .thenReturn(List.of(new AdminSkillSummaryResponse(
                        10L, "team-a", "demo", "Demo", List.of(),
                        "owner-1", "Owner One", "PUBLIC", "ACTIVE", false,
                        null, null, null, null, null, "NONE")));

        // Status and label are normalized by the service; the keyword is passed
        // through raw and normalized inside the query implementation.
        PageResponse<AdminSkillSummaryResponse> response =
                service.listSkills("demo", " active ", true, " official ", 0, 20);

        assertThat(response.total()).isEqualTo(1);
        assertThat(response.items()).hasSize(1);
        assertThat(response.items().get(0).id()).isEqualTo(10L);
    }

    @Test
    void listSkills_rejectsUnknownStatusValue() {
        assertThatThrownBy(() -> service.listSkills(null, "NOT_A_STATUS", null, null, 0, 20))
                .isInstanceOf(DomainBadRequestException.class);
    }

    @Test
    void listSkills_passesNullFiltersThroughWhenParametersAbsent() {
        when(adminSkillQueryRepository.findSkills(
                isNull(), isNull(), isNull(), isNull(), eq(PageRequest.of(0, 20))))
                .thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 20), 0));
        when(adminSkillQueryRepository.getSkillSummaries(List.of())).thenReturn(List.of());

        PageResponse<AdminSkillSummaryResponse> response = service.listSkills(null, null, null, null, 0, 20);

        assertThat(response.total()).isZero();
        assertThat(response.items()).isEmpty();
    }

    @Test
    void skillDetail_missingSkill_returns404() {
        when(skillRepository.findById(404L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getSkillDetail(404L))
                .isInstanceOf(DomainNotFoundException.class);
    }

    @Test
    void skillDetail_existingSkill_delegatesToQueryRepository() {
        Skill skill = createSkill(11L);
        when(skillRepository.findById(11L)).thenReturn(Optional.of(skill));
        AdminSkillDetailResponse detail = new AdminSkillDetailResponse(
                new AdminSkillSummaryResponse(
                        11L, "team-a", "demo", "Demo", List.of(),
                        "owner-1", "Owner One", "PUBLIC", "ACTIVE", false,
                        null, null, null, null, null, "NONE"),
                "summary text",
                List.of());
        when(adminSkillQueryRepository.getSkillDetail(skill)).thenReturn(detail);

        assertThat(service.getSkillDetail(11L)).isSameAs(detail);
    }

    @Test
    void versionFiles_missingSkill_returns404() {
        when(skillRepository.findById(404L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.listVersionFiles(404L, 1L))
                .isInstanceOf(DomainNotFoundException.class);
    }

    @Test
    void versionFiles_missingVersion_returns404() {
        Skill skill = createSkill(12L);
        when(skillRepository.findById(12L)).thenReturn(Optional.of(skill));
        when(skillVersionRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.listVersionFiles(12L, 999L))
                .isInstanceOf(DomainNotFoundException.class);
    }

    @Test
    void versionFiles_versionFromAnotherSkill_returns404() {
        Skill skill = createSkill(12L);
        SkillVersion otherSkillVersion = new SkillVersion(555L, "1.0.0", "owner");
        when(skillRepository.findById(12L)).thenReturn(Optional.of(skill));
        when(skillVersionRepository.findById(88L)).thenReturn(Optional.of(otherSkillVersion));

        assertThatThrownBy(() -> service.listVersionFiles(12L, 88L))
                .isInstanceOf(DomainNotFoundException.class);
    }

    @Test
    void versionFiles_mapsOnlySafePackageMetadata() {
        Skill skill = createSkill(13L);
        SkillVersion version = new SkillVersion(13L, "1.0.0", "owner");
        when(skillRepository.findById(13L)).thenReturn(Optional.of(skill));
        when(skillVersionRepository.findById(77L)).thenReturn(Optional.of(version));
        when(skillFileRepository.findByVersionId(77L)).thenReturn(List.of(
                new SkillFile(77L, "SKILL.md", 512L, "text/markdown", "abc", "internal/tenant/key/SKILL.md")
        ));

        List<SkillFileResponse> files = service.listVersionFiles(13L, 77L);

        assertThat(files).hasSize(1);
        // The response record exposes exactly the five safe fields; storageKey is structurally absent.
        SkillFileResponse file = files.get(0);
        assertThat(file.id()).isNull();
        assertThat(file.filePath()).isEqualTo("SKILL.md");
        assertThat(file.fileSize()).isEqualTo(512L);
        assertThat(file.contentType()).isEqualTo("text/markdown");
        assertThat(file.sha256()).isEqualTo("abc");
    }

    private Skill createSkill(Long id) {
        Skill skill = new Skill(1L, "demo", "owner-1", SkillVisibility.PUBLIC);
        skill.setStatus(SkillStatus.ACTIVE);
        org.springframework.test.util.ReflectionTestUtils.setField(skill, "id", id);
        return skill;
    }
}
