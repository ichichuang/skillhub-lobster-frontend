import { describe, expect, it } from 'vitest'
import '@/i18n/config'
import { resolveNotificationDisplay } from './notification-content'

const item = {
  category: 'REVIEW',
  eventType: 'REVIEW_SUBMITTED',
  title: 'New review submitted for: Calendar',
  bodyJson: JSON.stringify({ skillName: 'Calendar', version: '1.0.0' }),
  status: 'UNREAD',
  createdAt: '2026-03-20T00:00:00Z',
  id: 1,
} as const

describe('resolveNotificationDisplay', () => {
  it('renders review submitted content in Simplified Chinese', () => {
    const display = resolveNotificationDisplay({ ...item }, 'zh-CN')

    expect(display.title).toBe('技能审核提交')
    expect(display.description).toContain('Calendar')
    expect(display.description).toContain('1.0.0')
  })

  it('renders localized copy when passed an explicit language', () => {
    const display = resolveNotificationDisplay({ ...item }, 'en')

    expect(display.title).toBe('Skill review submitted')
    expect(display.description).toBe('Calendar(1.0.0) has been submitted for review.')
  })

  it('renders Traditional Chinese copy for zh-TW', () => {
    const display = resolveNotificationDisplay({ ...item }, 'zh-TW')

    expect(display.title).toBe('技能稽核提交')
    expect(display.description).toBe('Calendar（1.0.0）已提交稽核。')
  })

  it.each([
    ['REVIEW_SUBMITTED', 'Skill review submitted', 'Calendar(1.0.0) has been submitted for review.'],
    ['REVIEW_APPROVED', 'Skill review approved', 'Calendar(1.0.0) passed review.'],
    ['REVIEW_REJECTED', 'Skill review rejected', 'Calendar(1.0.0) did not pass review.'],
    ['PROMOTION_SUBMITTED', 'Skill promotion submitted', 'Calendar(1.0.0) has been submitted for promotion.'],
    ['PROMOTION_APPROVED', 'Skill promotion approved', 'Calendar(1.0.0) has been approved for promotion.'],
    ['PROMOTION_REJECTED', 'Skill promotion rejected', 'Calendar(1.0.0) was not approved for promotion.'],
    ['REPORT_SUBMITTED', 'Skill report submitted', 'A new report was received for Calendar.'],
    ['REPORT_RESOLVED', 'Skill report resolved', 'The report for Calendar has been resolved.'],
    ['SKILL_PUBLISHED', 'Skill published', 'Calendar(1.0.0) has been published.'],
    ['SUBSCRIPTION_NEW_VERSION', 'Subscribed skill update', 'Calendar(1.0.0) published a new version.'],
    ['SUBSCRIPTION_VERSION_YANKED', 'Subscribed skill version yanked', 'The version Calendar(1.0.0) has been yanked.'],
  ])('renders %s with localized English copy', (eventType, title, description) => {
    const display = resolveNotificationDisplay({
      category: 'REVIEW',
      eventType,
      title: 'Backend supplied title',
      bodyJson: JSON.stringify({ skillName: 'Calendar', version: '1.0.0' }),
      status: 'UNREAD',
      createdAt: '2026-03-20T00:00:00Z',
      id: 1,
    }, 'en')

    expect(display).toEqual({ title, description })
  })

  it('falls back to the runtime language when no explicit language is passed', () => {
    const display = resolveNotificationDisplay({ ...item })

    expect(display.title).toBe('技能审核提交')
  })

  it('falls back to the backend title when the event type is unsupported', () => {
    const display = resolveNotificationDisplay({
      category: 'PUBLISH',
      eventType: 'CUSTOM_EVENT',
      title: 'Backend supplied title',
      status: 'UNREAD',
      createdAt: '2026-03-20T00:00:00Z',
      id: 2,
    }, 'en')

    expect(display.title).toBe('Backend supplied title')
    expect(display.description).toBe('')
  })
})
