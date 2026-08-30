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

export function resolveNotificationDisplay(item: NotificationItem, _language?: string): NotificationDisplay {
  void _language
  const body = parseBody(item.bodyJson)
  const skillName = body.skillName ?? ''
  const version = body.version ?? ''
  const versionSuffix = version ? `（${version}）` : ''

  switch (item.eventType) {
    case 'REVIEW_SUBMITTED':
      return {
        title: '技能审核提交',
        description: skillName ? `${skillName}${versionSuffix}已提交审核。` : '',
      }
    case 'REVIEW_APPROVED':
      return {
        title: '技能审核通过',
        description: skillName ? `${skillName}${versionSuffix}已审核通过。` : '',
      }
    case 'REVIEW_REJECTED':
      return {
        title: '技能审核驳回',
        description: skillName ? `${skillName}${versionSuffix}审核未通过。` : '',
      }
    case 'PROMOTION_SUBMITTED':
      return {
        title: '技能推广提交',
        description: skillName ? `${skillName}${versionSuffix}已提交推广。` : '',
      }
    case 'PROMOTION_APPROVED':
      return {
        title: '技能推广通过',
        description: skillName ? `${skillName}${versionSuffix}推广已通过。` : '',
      }
    case 'PROMOTION_REJECTED':
      return {
        title: '技能推广驳回',
        description: skillName ? `${skillName}${versionSuffix}推广未通过。` : '',
      }
    case 'REPORT_SUBMITTED':
      return {
        title: '技能举报提交',
        description: skillName ? `${skillName} 收到新的举报。` : '',
      }
    case 'REPORT_RESOLVED':
      return {
        title: '技能举报已处理',
        description: skillName ? `${skillName} 的举报已处理。` : '',
      }
    case 'SKILL_PUBLISHED':
      return {
        title: '技能发布成功',
        description: skillName ? `${skillName}${versionSuffix}已发布。` : '',
      }
    case 'SUBSCRIPTION_NEW_VERSION':
      return {
        title: '订阅技能更新',
        description: skillName ? `${skillName}${versionSuffix}发布了新版本。` : '',
      }
    case 'SUBSCRIPTION_VERSION_YANKED':
      return {
        title: '订阅技能版本撤回',
        description: skillName ? `${skillName}${versionSuffix}版本已撤回。` : '',
      }
    default:
      return {
        title: item.title,
        description: '',
      }
  }
}
