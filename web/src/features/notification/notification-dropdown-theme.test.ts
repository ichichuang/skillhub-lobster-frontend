import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  NOTIFICATION_DROPDOWN_CLASS_NAME,
  NOTIFICATION_ITEM_CLASS_NAME,
  formatNotificationRelativeTime,
} from './notification-dropdown'

describe('notification dropdown theme contract', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('uses semantic floating-surface and interaction tokens', () => {
    expect(NOTIFICATION_DROPDOWN_CLASS_NAME).toContain('bg-popover')
    expect(NOTIFICATION_DROPDOWN_CLASS_NAME).toContain('border-border')
    expect(NOTIFICATION_DROPDOWN_CLASS_NAME).toContain('shadow-popover')
    expect(NOTIFICATION_DROPDOWN_CLASS_NAME).not.toContain('bg-white')
    expect(NOTIFICATION_ITEM_CLASS_NAME).toContain('hover:bg-surface-hover')
    expect(NOTIFICATION_ITEM_CLASS_NAME).not.toContain('gray')
  })

  it('uses fixed Chinese relative time regardless of the active language', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-20T12:00:00Z'))

    expect(formatNotificationRelativeTime('2026-03-20T11:59:30Z')).toBe('刚刚')
    expect(formatNotificationRelativeTime('2026-03-20T11:55:00Z')).toBe('5分钟')
    expect(formatNotificationRelativeTime('2026-03-20T10:00:00Z')).toBe('2小时')
    expect(formatNotificationRelativeTime('2026-03-18T12:00:00Z')).toBe('2天')
    expect(formatNotificationRelativeTime('2026-01-02T12:00:00Z')).toBe('2026/1/2')
  })
})
