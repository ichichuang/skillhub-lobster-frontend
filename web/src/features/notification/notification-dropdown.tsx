import { useTranslation } from 'react-i18next'
import { Link } from '@tanstack/react-router'
import type { NotificationItem } from '@/api/types'
import { getNotificationItems } from './notification-page'
import { resolveNotificationDisplay } from './notification-content'
import { useAuth } from '@/features/auth/use-auth'
import { useNotifications, useMarkAllRead, useMarkRead } from './use-notifications'
import { resolveNotificationTarget } from './notification-target'

interface Props {
  onClose: () => void
}

export const NOTIFICATION_DROPDOWN_CLASS_NAME =
  'absolute right-0 top-10 z-50 w-80 rounded-xl border border-border bg-popover text-popover-foreground shadow-popover'
export const NOTIFICATION_ITEM_CLASS_NAME =
  'flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-hover'

function formatRelativeTime(dateStr: string, lang: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days = Math.floor(diff / 86_400_000)

  const isChinese = lang.startsWith('zh')

  if (minutes < 1) return isChinese ? '刚刚' : 'just now'
  if (minutes < 60) return isChinese ? `${minutes}分钟` : `${minutes}m`
  if (hours < 24) return isChinese ? `${hours}小时` : `${hours}h`
  if (days < 30) return isChinese ? `${days}天` : `${days}d`
  return new Date(dateStr).toLocaleDateString()
}

/**
 * Dropdown panel showing the latest 5 notifications with mark-all-read and view-all actions.
 */
export function NotificationDropdown({ onClose }: Props) {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const { data, isLoading } = useNotifications(user?.userId, 0, 5)
  const markAllRead = useMarkAllRead(user?.userId)
  const markRead = useMarkRead(user?.userId)

  const notifications = getNotificationItems(data)

  function handleItemClick(item: NotificationItem) {
    if (item.status === 'UNREAD') {
      markRead.mutate(item.id)
    }
    onClose()
  }

  function handleMarkAllRead() {
    markAllRead.mutate()
  }

  return (
    <div
      className={NOTIFICATION_DROPDOWN_CLASS_NAME}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-divider px-4 py-3">
        <span className="text-sm font-semibold text-foreground">
          {t('notification.title')}
        </span>
        <button
          type="button"
          onClick={handleMarkAllRead}
          disabled={markAllRead.isPending || notifications.length === 0}
          className="text-xs text-foreground-secondary transition-opacity hover:opacity-70 disabled:opacity-40"
        >
          {t('notification.markAllRead')}
        </button>
      </div>

      {/* Body */}
      <ul className="max-h-72 divide-y divide-divider overflow-y-auto">
        {isLoading ? (
          <li className="px-4 py-6 text-center text-sm text-muted-foreground">
            …
          </li>
        ) : notifications.length === 0 ? (
          <li className="px-4 py-6 text-center text-sm text-muted-foreground">
            {t('notification.empty')}
          </li>
        ) : (
          notifications.map((item) => (
            <li key={item.id}>
              {(() => {
                const display = resolveNotificationDisplay(item, i18n.language)
                return (
              <Link
                to={resolveNotificationTarget(item)}
                onClick={() => handleItemClick(item)}
                className={NOTIFICATION_ITEM_CLASS_NAME}
              >
                {/* Unread dot */}
                <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${item.status === 'UNREAD' ? 'bg-danger' : 'bg-transparent'}`} />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm text-foreground">
                    {display.title}
                  </p>
                  {display.description ? (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {display.description}
                    </p>
                  ) : null}
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t('notification.timeAgo', { time: formatRelativeTime(item.createdAt, i18n.language) })}
                  </p>
                </div>
              </Link>
                )
              })()}
            </li>
          ))
        )}
      </ul>

      {/* Footer */}
      <div className="border-t border-divider px-4 py-2.5 text-center">
        <Link
          to="/dashboard/notifications"
          onClick={onClose}
          className="text-xs text-foreground-secondary transition-opacity hover:opacity-70"
        >
          {t('notification.viewAll')}
        </Link>
      </div>
    </div>
  )
}
