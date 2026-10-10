import i18n from '@/i18n/config'
import type { NotificationItem } from '@/api/types'

export type NotificationDisplay = {
  title: string
  description: string
}

type NotificationBody = {
  skillName?: string
  version?: string
}

function parseBody(bodyJson?: string): NotificationBody {
  if (!bodyJson) {
    return {}
  }
  try {
    const parsed = JSON.parse(bodyJson)
    return typeof parsed === 'object' && parsed !== null ? parsed as NotificationBody : {}
  } catch {
    return {}
  }
}

export function resolveNotificationDisplay(item: NotificationItem, language?: string): NotificationDisplay {
  const t = language ? i18n.getFixedT(language) : i18n.t
  const body = parseBody(item.bodyJson)
  const skillName = body.skillName ?? ''
  const version = body.version ?? ''
  const versionSuffix = version ? t('notification.versionSuffix', { version }) : ''

  switch (item.eventType) {
    case 'REVIEW_SUBMITTED':
      return {
        title: t('notification.event.reviewSubmitted.title'),
        description: skillName ? t('notification.event.reviewSubmitted.description', { skillName, versionSuffix }) : '',
      }
    case 'REVIEW_APPROVED':
      return {
        title: t('notification.event.reviewApproved.title'),
        description: skillName ? t('notification.event.reviewApproved.description', { skillName, versionSuffix }) : '',
      }
    case 'REVIEW_REJECTED':
      return {
        title: t('notification.event.reviewRejected.title'),
        description: skillName ? t('notification.event.reviewRejected.description', { skillName, versionSuffix }) : '',
      }
    case 'PROMOTION_SUBMITTED':
      return {
        title: t('notification.event.promotionSubmitted.title'),
        description: skillName ? t('notification.event.promotionSubmitted.description', { skillName, versionSuffix }) : '',
      }
    case 'PROMOTION_APPROVED':
      return {
        title: t('notification.event.promotionApproved.title'),
        description: skillName ? t('notification.event.promotionApproved.description', { skillName, versionSuffix }) : '',
      }
    case 'PROMOTION_REJECTED':
      return {
        title: t('notification.event.promotionRejected.title'),
        description: skillName ? t('notification.event.promotionRejected.description', { skillName, versionSuffix }) : '',
      }
    case 'REPORT_SUBMITTED':
      return {
        title: t('notification.event.reportSubmitted.title'),
        description: skillName ? t('notification.event.reportSubmitted.description', { skillName }) : '',
      }
    case 'REPORT_RESOLVED':
      return {
        title: t('notification.event.reportResolved.title'),
        description: skillName ? t('notification.event.reportResolved.description', { skillName }) : '',
      }
    case 'SKILL_PUBLISHED':
      return {
        title: t('notification.event.skillPublished.title'),
        description: skillName ? t('notification.event.skillPublished.description', { skillName, versionSuffix }) : '',
      }
    case 'SUBSCRIPTION_NEW_VERSION':
      return {
        title: t('notification.event.subscriptionNewVersion.title'),
        description: skillName ? t('notification.event.subscriptionNewVersion.description', { skillName, versionSuffix }) : '',
      }
    case 'SUBSCRIPTION_VERSION_YANKED':
      return {
        title: t('notification.event.subscriptionVersionYanked.title'),
        description: skillName ? t('notification.event.subscriptionVersionYanked.description', { skillName, versionSuffix }) : '',
      }
    default:
      return {
        title: item.title,
        description: '',
      }
  }
}
