import { describe, expect, it } from 'vitest'
import {
  NOTIFICATION_BADGE_CLASS_NAME,
  NOTIFICATION_BELL_CLASS_NAME,
  resolveNotificationUserId,
} from './notification-bell'

describe('resolveNotificationUserId', () => {
  it('returns the current authenticated user id for notification-scoped queries', () => {
    expect(resolveNotificationUserId({ userId: 'user-b' })).toBe('user-b')
  })

  it('returns undefined when there is no authenticated user', () => {
    expect(resolveNotificationUserId(null)).toBeUndefined()
    expect(resolveNotificationUserId(undefined)).toBeUndefined()
  })

  it('uses semantic interaction and status tokens', () => {
    expect(NOTIFICATION_BELL_CLASS_NAME).toContain('hover:bg-surface-hover')
    expect(NOTIFICATION_BELL_CLASS_NAME).not.toContain('gray')
    expect(NOTIFICATION_BADGE_CLASS_NAME).toContain('bg-danger')
    expect(NOTIFICATION_BADGE_CLASS_NAME).not.toContain('text-white')
  })
})
