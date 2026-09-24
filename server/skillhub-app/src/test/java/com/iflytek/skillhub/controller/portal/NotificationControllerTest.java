package com.iflytek.skillhub.controller.portal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.iflytek.skillhub.dto.ApiResponseFactory;
import com.iflytek.skillhub.dto.NotificationResponse;
import com.iflytek.skillhub.dto.PageResponse;
import com.iflytek.skillhub.domain.shared.exception.DomainBadRequestException;
import com.iflytek.skillhub.notification.domain.Notification;
import com.iflytek.skillhub.notification.domain.NotificationCategory;
import com.iflytek.skillhub.notification.service.NotificationService;
import com.iflytek.skillhub.observability.RequestIdAccessor;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.support.StaticMessageSource;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.RequestMapping;

@ExtendWith(MockitoExtension.class)
class NotificationControllerTest {

    @Mock
    private NotificationService notificationService;

    private NotificationController controller;

    @BeforeEach
    void setUp() {
        StaticMessageSource messageSource = new StaticMessageSource();
        messageSource.addMessage("response.success.read", java.util.Locale.getDefault(), "ok");
        ApiResponseFactory responseFactory = new ApiResponseFactory(
                messageSource,
                Clock.fixed(Instant.parse("2026-03-20T00:00:00Z"), ZoneOffset.UTC),
                new RequestIdAccessor()
        );
        controller = new NotificationController(notificationService, new ObjectMapper(), responseFactory);
    }

    @Test
    void list_shouldExposeReviewTargetRouteForSubmittedReviewNotifications() {
        Notification notification = notification(
                11L,
                NotificationCategory.REVIEW,
                "REVIEW_SUBMITTED",
                "{\"namespace\":\"demo\",\"slug\":\"skill-a\"}",
                "REVIEW",
                99L
        );
        when(notificationService.list(org.mockito.ArgumentMatchers.eq("user-1"), org.mockito.ArgumentMatchers.eq(NotificationCategory.REVIEW), org.mockito.ArgumentMatchers.isNull(), org.mockito.ArgumentMatchers.any(Pageable.class)))
                .thenReturn(new PageImpl<>(java.util.List.of(notification)));

        PageResponse<NotificationResponse> page = controller.list("user-1", "REVIEW", null, 0, 20).data();

        assertThat(page.items()).singleElement().satisfies(item -> {
            assertThat(item.targetType()).isEqualTo("REVIEW");
            assertThat(item.targetId()).isEqualTo(99L);
            assertThat(item.targetRoute()).isEqualTo("/dashboard/reviews/99");
        });
        verify(notificationService).list(org.mockito.ArgumentMatchers.eq("user-1"), org.mockito.ArgumentMatchers.eq(NotificationCategory.REVIEW), org.mockito.ArgumentMatchers.isNull(), org.mockito.ArgumentMatchers.any(Pageable.class));
    }

    @Test
    void list_shouldExposeProfileReviewTargetRouteForSubmittedProfileReviewNotifications() {
        Notification notification = notification(
                15L,
                NotificationCategory.REVIEW,
                "PROFILE_REVIEW_SUBMITTED",
                "{\"profileReviewId\":77,\"submitterId\":\"user-1\",\"fields\":[\"displayName\"]}",
                "PROFILE_REVIEW",
                77L
        );
        when(notificationService.list(org.mockito.ArgumentMatchers.eq("admin-1"), org.mockito.ArgumentMatchers.eq(NotificationCategory.REVIEW), org.mockito.ArgumentMatchers.isNull(), org.mockito.ArgumentMatchers.any(Pageable.class)))
                .thenReturn(new PageImpl<>(java.util.List.of(notification)));

        PageResponse<NotificationResponse> page = controller.list("admin-1", "REVIEW", null, 0, 20).data();

        assertThat(page.items()).singleElement().satisfies(item -> {
            assertThat(item.targetType()).isEqualTo("PROFILE_REVIEW");
            assertThat(item.targetId()).isEqualTo(77L);
            assertThat(item.targetRoute()).isEqualTo("/dashboard/reviews?type=profile");
        });
    }

    @Test
    void list_shouldExposeSkillRouteForResolvedWorkflowNotifications() {
        Notification notification = notification(
                12L,
                NotificationCategory.REVIEW,
                "REVIEW_APPROVED",
                "{\"namespace\":\"demo\",\"slug\":\"skill-a\"}",
                "SKILL",
                101L
        );
        when(notificationService.list(org.mockito.ArgumentMatchers.eq("user-1"), org.mockito.ArgumentMatchers.isNull(), org.mockito.ArgumentMatchers.isNull(), org.mockito.ArgumentMatchers.any(Pageable.class)))
                .thenReturn(new PageImpl<>(java.util.List.of(notification)));

        PageResponse<NotificationResponse> page = controller.list("user-1", null, null, 0, 20).data();

        assertThat(page.items()).singleElement().satisfies(item -> {
            assertThat(item.targetType()).isEqualTo("SKILL");
            assertThat(item.targetId()).isEqualTo(101L);
            assertThat(item.targetRoute()).isEqualTo("/space/demo/skill-a");
        });
    }

    @Test
    void deleteRead_shouldDelegateToService() {
        controller.deleteRead(10L, "user-1");

        verify(notificationService).deleteRead(10L, "user-1");
    }

    @Test
    void list_shouldExposePromotionInboxRouteForPromotionSubmittedNotifications() {
        Notification notification = notification(
                13L,
                NotificationCategory.PROMOTION,
                "PROMOTION_SUBMITTED",
                "{\"namespace\":\"demo\",\"slug\":\"skill-a\"}",
                "PROMOTION",
                33L
        );
        when(notificationService.list(org.mockito.ArgumentMatchers.eq("user-1"), org.mockito.ArgumentMatchers.eq(NotificationCategory.PROMOTION), org.mockito.ArgumentMatchers.isNull(), org.mockito.ArgumentMatchers.any(Pageable.class)))
                .thenReturn(new PageImpl<>(java.util.List.of(notification)));

        PageResponse<NotificationResponse> page = controller.list("user-1", "PROMOTION", null, 0, 20).data();

        assertThat(page.items()).singleElement().satisfies(item -> {
            assertThat(item.targetType()).isEqualTo("PROMOTION");
            assertThat(item.targetId()).isEqualTo(33L);
            assertThat(item.targetRoute()).isEqualTo("/dashboard/promotions");
        });
    }

    @Test
    void list_shouldExposeReportInboxRouteForReportSubmittedNotifications() {
        Notification notification = notification(
                14L,
                NotificationCategory.REPORT,
                "REPORT_SUBMITTED",
                "{\"namespace\":\"demo\",\"slug\":\"skill-a\"}",
                "REPORT",
                44L
        );
        when(notificationService.list(org.mockito.ArgumentMatchers.eq("user-1"), org.mockito.ArgumentMatchers.eq(NotificationCategory.REPORT), org.mockito.ArgumentMatchers.isNull(), org.mockito.ArgumentMatchers.any(Pageable.class)))
                .thenReturn(new PageImpl<>(java.util.List.of(notification)));

        PageResponse<NotificationResponse> page = controller.list("user-1", "REPORT", null, 0, 20).data();

        assertThat(page.items()).singleElement().satisfies(item -> {
            assertThat(item.targetType()).isEqualTo("REPORT");
            assertThat(item.targetId()).isEqualTo(44L);
            assertThat(item.targetRoute()).isEqualTo("/dashboard/reports");
        });
    }

    @Nested
    class ExcludeCategoryContract {

        @Test
        void list_withoutExcludeCategory_forwardsNullExclusionAndKeepsCategoryFilter() {
            when(notificationService.list(
                    org.mockito.ArgumentMatchers.eq("user-1"),
                    org.mockito.ArgumentMatchers.eq(NotificationCategory.REVIEW),
                    org.mockito.ArgumentMatchers.isNull(),
                    org.mockito.ArgumentMatchers.any(Pageable.class)))
                    .thenReturn(new PageImpl<>(java.util.List.of()));

            controller.list("user-1", "REVIEW", null, 0, 20);

            verify(notificationService).list(
                    org.mockito.ArgumentMatchers.eq("user-1"),
                    org.mockito.ArgumentMatchers.eq(NotificationCategory.REVIEW),
                    org.mockito.ArgumentMatchers.isNull(),
                    org.mockito.ArgumentMatchers.any(Pageable.class));
        }

        @Test
        void list_withExcludeCategory_forwardsParsedExclusion() {
            when(notificationService.list(
                    org.mockito.ArgumentMatchers.eq("user-1"),
                    org.mockito.ArgumentMatchers.isNull(),
                    org.mockito.ArgumentMatchers.eq(NotificationCategory.PROMOTION),
                    org.mockito.ArgumentMatchers.any(Pageable.class)))
                    .thenReturn(new PageImpl<>(java.util.List.of()));

            controller.list("user-1", null, "PROMOTION", 0, 20);

            verify(notificationService).list(
                    org.mockito.ArgumentMatchers.eq("user-1"),
                    org.mockito.ArgumentMatchers.isNull(),
                    org.mockito.ArgumentMatchers.eq(NotificationCategory.PROMOTION),
                    org.mockito.ArgumentMatchers.any(Pageable.class));
        }

        @Test
        void list_withCategoryAndExcludeCategory_forwardsBoth() {
            when(notificationService.list(
                    org.mockito.ArgumentMatchers.eq("user-1"),
                    org.mockito.ArgumentMatchers.eq(NotificationCategory.REVIEW),
                    org.mockito.ArgumentMatchers.eq(NotificationCategory.PROMOTION),
                    org.mockito.ArgumentMatchers.any(Pageable.class)))
                    .thenReturn(new PageImpl<>(java.util.List.of()));

            controller.list("user-1", "REVIEW", "PROMOTION", 0, 20);

            verify(notificationService).list(
                    org.mockito.ArgumentMatchers.eq("user-1"),
                    org.mockito.ArgumentMatchers.eq(NotificationCategory.REVIEW),
                    org.mockito.ArgumentMatchers.eq(NotificationCategory.PROMOTION),
                    org.mockito.ArgumentMatchers.any(Pageable.class));
        }

        @Test
        void list_withMalformedExcludeCategory_rejectsLikeCategoryParameter() {
            org.assertj.core.api.Assertions.assertThatThrownBy(
                            () -> controller.list("user-1", null, "NOT_A_CATEGORY", 0, 20))
                    .isInstanceOf(DomainBadRequestException.class);
        }

        @Test
        void unreadCount_withoutExcludeCategory_forwardsNullExclusion() {
            when(notificationService.getUnreadCount(org.mockito.ArgumentMatchers.eq("user-1"), org.mockito.ArgumentMatchers.isNull()))
                    .thenReturn(3L);

            controller.unreadCount("user-1", null);

            verify(notificationService).getUnreadCount(org.mockito.ArgumentMatchers.eq("user-1"), org.mockito.ArgumentMatchers.isNull());
        }

        @Test
        void unreadCount_withExcludeCategory_forwardsParsedExclusion() {
            when(notificationService.getUnreadCount(
                    org.mockito.ArgumentMatchers.eq("user-1"),
                    org.mockito.ArgumentMatchers.eq(NotificationCategory.PROMOTION)))
                    .thenReturn(2L);

            var result = controller.unreadCount("user-1", "PROMOTION");

            assertThat(result.data()).containsEntry("count", 2L);
            verify(notificationService).getUnreadCount(
                    org.mockito.ArgumentMatchers.eq("user-1"),
                    org.mockito.ArgumentMatchers.eq(NotificationCategory.PROMOTION));
        }

        @Test
        void unreadCount_withMalformedExcludeCategory_rejectsLikeCategoryParameter() {
            org.assertj.core.api.Assertions.assertThatThrownBy(
                            () -> controller.unreadCount("user-1", "NOT_A_CATEGORY"))
                    .isInstanceOf(DomainBadRequestException.class);
        }
    }

    @Nested
    class DualSurfaceMapping {

        @Test
        void excludeCategory_isAvailableOnBothWebAndV1Surfaces() {
            RequestMapping mapping = NotificationController.class.getAnnotation(RequestMapping.class);

            assertThat(mapping).isNotNull();
            assertThat(mapping.value()).containsExactlyInAnyOrder("/api/v1/notifications", "/api/web/notifications");
        }

        @Test
        void excludeCategory_bindsThroughWebSurface() throws Exception {
            MockMvc mockMvc = MockMvcBuilders.standaloneSetup(controller).build();
            when(notificationService.list(
                    org.mockito.ArgumentMatchers.eq("user-1"),
                    org.mockito.ArgumentMatchers.isNull(),
                    org.mockito.ArgumentMatchers.eq(NotificationCategory.PROMOTION),
                    org.mockito.ArgumentMatchers.any(Pageable.class)))
                    .thenReturn(new PageImpl<>(java.util.List.of()));

            mockMvc.perform(get("/api/web/notifications")
                            .requestAttr("userId", "user-1")
                            .param("excludeCategory", "PROMOTION"))
                    .andExpect(status().isOk());

            verify(notificationService).list(
                    org.mockito.ArgumentMatchers.eq("user-1"),
                    org.mockito.ArgumentMatchers.isNull(),
                    org.mockito.ArgumentMatchers.eq(NotificationCategory.PROMOTION),
                    org.mockito.ArgumentMatchers.any(Pageable.class));
        }

        @Test
        void excludeCategory_bindsThroughV1Surface() throws Exception {
            MockMvc mockMvc = MockMvcBuilders.standaloneSetup(controller).build();
            when(notificationService.getUnreadCount(
                    org.mockito.ArgumentMatchers.eq("user-1"),
                    org.mockito.ArgumentMatchers.eq(NotificationCategory.PROMOTION)))
                    .thenReturn(5L);

            mockMvc.perform(get("/api/v1/notifications/unread-count")
                            .requestAttr("userId", "user-1")
                            .param("excludeCategory", "PROMOTION"))
                    .andExpect(status().isOk());

            verify(notificationService).getUnreadCount(
                    org.mockito.ArgumentMatchers.eq("user-1"),
                    org.mockito.ArgumentMatchers.eq(NotificationCategory.PROMOTION));
        }
    }

    private Notification notification(Long id,
                                      NotificationCategory category,
                                      String eventType,
                                      String bodyJson,
                                      String entityType,
                                      Long entityId) {
        Notification notification = new Notification(
                "user-1",
                category,
                eventType,
                "Title",
                bodyJson,
                entityType,
                entityId,
                Instant.parse("2026-03-20T00:00:00Z")
        );
        ReflectionTestUtils.setField(notification, "id", id);
        return notification;
    }
}
