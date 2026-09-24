import type { NotificationItem } from '@/api/types'

/**
 * Lobster product rule: Promotion (提升) has no active notification action. Promotion
 * items (including stale browser-cached rows with an old promotions targetRoute) fall
 * back to the notifications page instead of advertising the promotions surface.
 */
export function resolveNotificationTarget(item: NotificationItem): string {
  if (item.category === 'PROMOTION' || item.entityType?.toLowerCase() === 'promotion') {
    return '/dashboard/notifications'
  }

  if (isSafeInternalRoute(item.targetRoute)) {
    return item.targetRoute === '/dashboard/promotions' ? '/dashboard/notifications' : item.targetRoute
  }

  switch (item.entityType?.toLowerCase()) {
    case 'review':
      return item.entityId ? `/dashboard/reviews/${item.entityId}` : '/dashboard/reviews'
    case 'report':
      return '/dashboard/reports'
    default:
      return '/dashboard/notifications'
  }
}

function isSafeInternalRoute(targetRoute?: string | null): targetRoute is string {
  if (!targetRoute) {
    return false
  }
  return targetRoute.startsWith('/') && !targetRoute.startsWith('//')
}
