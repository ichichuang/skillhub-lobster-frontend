import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/features/auth/use-auth'
import { useUnreadCount } from './use-notifications'
import { useNotificationSse } from './use-notification-sse'
import { NotificationDropdown } from './notification-dropdown'

export const NOTIFICATION_BELL_CLASS_NAME =
  'relative flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-surface-hover'
export const NOTIFICATION_BADGE_CLASS_NAME =
  'absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-danger px-0.5 text-[10px] font-semibold leading-none text-destructive-foreground'

export function resolveNotificationUserId(user?: { userId?: string } | null) {
  return user?.userId
}

/**
 * Bell icon with unread badge. Toggles the notification dropdown on click.
 * SSE connection is established here at the authenticated user level.
 */
export function NotificationBell() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const notificationUserId = resolveNotificationUserId(user)
  const { data: unreadData } = useUnreadCount(notificationUserId)
  const unreadCount = unreadData?.count ?? 0

  useNotificationSse(notificationUserId)

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const badgeLabel = unreadCount > 99 ? '99+' : String(unreadCount)

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label={t('notification.title')}
        onClick={() => setOpen((v) => !v)}
        className={NOTIFICATION_BELL_CLASS_NAME}
      >
        {/* Bell SVG */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {/* Unread badge */}
        {unreadCount > 0 && (
          <span
            className={NOTIFICATION_BADGE_CLASS_NAME}
            aria-label={`${unreadCount} unread`}
          >
            {badgeLabel}
          </span>
        )}
      </button>

      {open && (
        <NotificationDropdown onClose={() => setOpen(false)} />
      )}
    </div>
  )
}
