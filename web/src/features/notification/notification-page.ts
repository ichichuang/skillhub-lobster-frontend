import type { NotificationItem, PagedResponse } from '@/api/types'

/**
 * Lobster product rule: Promotion (提升) is not an active notification surface.
 * The server already excludes it (excludeCategory=PROMOTION, commit 132d8740); this
 * guard only hides stale browser-cached Promotion rows from before that contract.
 * It never rewrites server totals or unread counts.
 */
const HIDDEN_CATEGORIES: ReadonlySet<NotificationItem['category']> = new Set(['PROMOTION'])

export function getNotificationItems(page?: PagedResponse<NotificationItem>) {
  return (page?.items ?? []).filter((item) => !HIDDEN_CATEGORIES.has(item.category))
}

export function getNotificationTotal(page?: PagedResponse<NotificationItem>) {
  return page?.total ?? 0
}

export function shouldShowNotificationPagination(total: number, pageSize: number) {
  return pageSize > 0 && total > pageSize
}
