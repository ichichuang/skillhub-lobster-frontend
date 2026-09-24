package com.iflytek.skillhub.notification.service;

import com.iflytek.skillhub.notification.domain.*;
import com.iflytek.skillhub.domain.shared.exception.DomainBadRequestException;
import com.iflytek.skillhub.domain.shared.exception.DomainForbiddenException;
import com.iflytek.skillhub.domain.shared.exception.DomainNotFoundException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;

@Service
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final NotificationPreferenceService preferenceService;
    private final Clock clock;

    public NotificationService(NotificationRepository notificationRepository,
                               NotificationPreferenceService preferenceService,
                               Clock clock) {
        this.notificationRepository = notificationRepository;
        this.preferenceService = preferenceService;
        this.clock = clock;
    }

    @Transactional
    public void create(String recipientId, NotificationCategory category,
                       String eventType, String title, String bodyJson,
                       String entityType, Long entityId) {
        if (!preferenceService.isEnabled(recipientId, category, NotificationChannel.IN_APP)) {
            return;
        }
        Notification notification = new Notification(recipientId, category, eventType,
                title, bodyJson, entityType, entityId, Instant.now(clock));
        notificationRepository.save(notification);
    }

    @Transactional(readOnly = true)
    public Page<Notification> list(String recipientId, NotificationCategory category, Pageable pageable) {
        return list(recipientId, category, null, pageable);
    }

    /**
     * Optional read-side exclusion: {@code excludedCategory} filters the category out at the
     * repository level before pagination/counting. Callers that omit it keep official behavior.
     */
    @Transactional(readOnly = true)
    public Page<Notification> list(String recipientId, NotificationCategory category,
                                   NotificationCategory excludedCategory, Pageable pageable) {
        if (category != null && excludedCategory != null) {
            return notificationRepository.findByRecipientIdAndCategoryAndCategoryNot(
                    recipientId, category, excludedCategory, pageable);
        }
        if (category != null) {
            return notificationRepository.findByRecipientIdAndCategory(recipientId, category, pageable);
        }
        if (excludedCategory != null) {
            return notificationRepository.findByRecipientIdAndCategoryNot(recipientId, excludedCategory, pageable);
        }
        return notificationRepository.findByRecipientId(recipientId, pageable);
    }

    @Transactional(readOnly = true)
    public long getUnreadCount(String recipientId) {
        return getUnreadCount(recipientId, null);
    }

    /**
     * Optional read-side exclusion for the unread badge: the excluded category is filtered
     * inside the count query itself, never by post-hoc subtraction.
     */
    @Transactional(readOnly = true)
    public long getUnreadCount(String recipientId, NotificationCategory excludedCategory) {
        if (excludedCategory != null) {
            return notificationRepository.countByRecipientIdAndStatusAndCategoryNot(
                    recipientId, NotificationStatus.UNREAD, excludedCategory);
        }
        return notificationRepository.countByRecipientIdAndStatus(recipientId, NotificationStatus.UNREAD);
    }

    @Transactional
    public void markRead(Long notificationId, String userId) {
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new DomainNotFoundException("error.notification.notFound", notificationId));
        if (!notification.getRecipientId().equals(userId)) {
            throw new DomainForbiddenException("error.notification.noPermission");
        }
        notification.markRead(Instant.now(clock));
        notificationRepository.save(notification);
    }

    @Transactional
    public int markAllRead(String userId) {
        return notificationRepository.markAllReadByRecipientId(userId, Instant.now(clock));
    }

    @Transactional
    public void deleteRead(Long notificationId, String userId) {
        int deleted = notificationRepository.deleteByIdAndRecipientIdAndStatus(
                notificationId,
                userId,
                NotificationStatus.READ
        );
        if (deleted == 0) {
            throw new DomainBadRequestException("error.notification.readNotFound", notificationId);
        }
    }
}
