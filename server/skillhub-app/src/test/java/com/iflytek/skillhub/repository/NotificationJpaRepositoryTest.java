package com.iflytek.skillhub.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.iflytek.skillhub.infra.jpa.NotificationJpaRepository;
import com.iflytek.skillhub.notification.domain.Notification;
import com.iflytek.skillhub.notification.domain.NotificationCategory;
import com.iflytek.skillhub.notification.domain.NotificationStatus;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.ActiveProfiles;

/**
 * Persistence-level contract for the optional excludeCategory read-side exclusion
 * on the global user-notification list and unread-count queries. Uses the H2 test
 * profile datasource; exclusion must happen inside the SQL query (before pagination
 * and counting), never by post-filtering results in Java.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
class NotificationJpaRepositoryTest {

    private static final String RECIPIENT = "user-1";
    private static final String OTHER_RECIPIENT = "user-2";

    @Autowired
    private NotificationJpaRepository repository;

    @Autowired
    private TestEntityManager entityManager;

    @BeforeEach
    void seedMixedNotifications() {
        persist(RECIPIENT, NotificationCategory.REVIEW, "2026-09-01T10:00:00Z", NotificationStatus.UNREAD);
        persist(RECIPIENT, NotificationCategory.REPORT, "2026-09-01T09:00:00Z", NotificationStatus.UNREAD);
        persist(RECIPIENT, NotificationCategory.PROMOTION, "2026-09-01T08:00:00Z", NotificationStatus.UNREAD);
        persist(RECIPIENT, NotificationCategory.PUBLISH, "2026-09-01T07:00:00Z", NotificationStatus.UNREAD);
        persist(RECIPIENT, NotificationCategory.PROMOTION, "2026-09-01T06:00:00Z", NotificationStatus.UNREAD);
        persist(RECIPIENT, NotificationCategory.REVIEW, "2026-09-01T05:00:00Z", NotificationStatus.UNREAD);
        persist(RECIPIENT, NotificationCategory.PROMOTION, "2026-09-01T04:00:00Z", NotificationStatus.READ);
        persist(RECIPIENT, NotificationCategory.REVIEW, "2026-09-01T03:00:00Z", NotificationStatus.READ);
        persist(OTHER_RECIPIENT, NotificationCategory.PROMOTION, "2026-09-01T09:30:00Z", NotificationStatus.UNREAD);
        entityManager.clear();
    }

    @Test
    void unfilteredQueriesStillReturnPromotionRowsInOfficialOrdering() {
        Page<Notification> page0 = repository.findByRecipientId(RECIPIENT, PageRequest.of(0, 3));
        Page<Notification> page1 = repository.findByRecipientId(RECIPIENT, PageRequest.of(1, 3));
        Page<Notification> page2 = repository.findByRecipientId(RECIPIENT, PageRequest.of(2, 3));

        assertThat(page0.getTotalElements()).isEqualTo(8);
        assertThat(page0.getTotalPages()).isEqualTo(3);
        assertThat(categoriesOf(page0)).containsExactly(
                NotificationCategory.REVIEW, NotificationCategory.REPORT, NotificationCategory.PROMOTION);
        assertThat(categoriesOf(page1)).containsExactly(
                NotificationCategory.PUBLISH, NotificationCategory.PROMOTION, NotificationCategory.REVIEW);
        assertThat(categoriesOf(page2)).containsExactly(
                NotificationCategory.PROMOTION, NotificationCategory.REVIEW);
    }

    @Test
    void exclusionFiltersPromotionBeforePaginationWithCorrectTotalsAndFilledPages() {
        Page<Notification> page0 = repository.findByRecipientIdAndCategoryNot(
                RECIPIENT, NotificationCategory.PROMOTION, PageRequest.of(0, 3));
        Page<Notification> page1 = repository.findByRecipientIdAndCategoryNot(
                RECIPIENT, NotificationCategory.PROMOTION, PageRequest.of(1, 3));

        assertThat(page0.getTotalElements()).isEqualTo(5);
        assertThat(page0.getTotalPages()).isEqualTo(2);
        assertThat(categoriesOf(page0)).containsExactly(
                NotificationCategory.REVIEW, NotificationCategory.REPORT, NotificationCategory.PUBLISH);
        assertThat(page1.getContent()).hasSize(2);
        assertThat(categoriesOf(page1)).containsExactly(NotificationCategory.REVIEW, NotificationCategory.REVIEW);
    }

    @Test
    void exclusionIntersectsWithExactCategoryFilter() {
        Page<Notification> page = repository.findByRecipientIdAndCategoryAndCategoryNot(
                RECIPIENT, NotificationCategory.REVIEW, NotificationCategory.PROMOTION, PageRequest.of(0, 3));

        assertThat(page.getTotalElements()).isEqualTo(3);
        assertThat(categoriesOf(page)).containsExactly(
                NotificationCategory.REVIEW, NotificationCategory.REVIEW, NotificationCategory.REVIEW);
    }

    @Test
    void exclusionMatchingExactCategoryReturnsEmptyPageWithZeroTotal() {
        Page<Notification> page = repository.findByRecipientIdAndCategoryAndCategoryNot(
                RECIPIENT, NotificationCategory.PROMOTION, NotificationCategory.PROMOTION, PageRequest.of(0, 3));

        assertThat(page.getContent()).isEmpty();
        assertThat(page.getTotalElements()).isZero();
    }

    @Test
    void unreadCountExcludesOnlyRequestedCategoryInDatabase() {
        long unfiltered = repository.countByRecipientIdAndStatus(RECIPIENT, NotificationStatus.UNREAD);
        long excluded = repository.countByRecipientIdAndStatusAndCategoryNot(
                RECIPIENT, NotificationStatus.UNREAD, NotificationCategory.PROMOTION);

        assertThat(unfiltered).isEqualTo(6L);
        assertThat(excluded).isEqualTo(4L);
    }

    private List<NotificationCategory> categoriesOf(Page<Notification> page) {
        return page.getContent().stream().map(Notification::getCategory).toList();
    }

    private void persist(String recipientId,
                         NotificationCategory category,
                         String createdAt,
                         NotificationStatus status) {
        Notification notification = new Notification(
                recipientId,
                category,
                category.name() + "_EVENT",
                "title-" + recipientId + "-" + category + "-" + createdAt,
                null,
                "SKILL",
                1L,
                Instant.parse(createdAt)
        );
        if (status == NotificationStatus.READ) {
            notification.markRead(Instant.parse(createdAt).plusSeconds(60));
        }
        entityManager.persistAndFlush(notification);
    }
}
