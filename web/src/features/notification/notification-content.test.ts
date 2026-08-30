import { describe, expect, it } from 'vitest'
import { resolveNotificationDisplay } from './notification-content'

describe('resolveNotificationDisplay', () => {
  it('renders review submitted content in Chinese', () => {
    const display = resolveNotificationDisplay({
      category: 'REVIEW',
      eventType: 'REVIEW_SUBMITTED',
      title: 'New review submitted for: Calendar',
      bodyJson: JSON.stringify({ skillName: 'Calendar', version: '1.0.0' }),
      status: 'UNREAD',
      createdAt: '2026-03-20T00:00:00Z',
      id: 1,
    }, 'zh-CN')

    expect(display.title).toBe('技能审核提交')
    expect(display.description).toContain('Calendar')
    expect(display.description).toContain('1.0.0')
  })

  it('renders known events in Chinese even when passed an English language', () => {
    const display = resolveNotificationDisplay({
      category: 'REVIEW',
      eventType: 'REVIEW_SUBMITTED',
      title: 'New review submitted for: Calendar',
      bodyJson: JSON.stringify({ skillName: 'Calendar', version: '1.0.0' }),
      status: 'UNREAD',
      createdAt: '2026-03-20T00:00:00Z',
      id: 1,
    }, 'en')

    expect(display.title).toBe('技能审核提交')
    expect(display.description).toBe('Calendar（1.0.0）已提交审核。')
  })

  it.each([
    ['REVIEW_SUBMITTED', '技能审核提交', 'Calendar（1.0.0）已提交审核。'],
    ['REVIEW_APPROVED', '技能审核通过', 'Calendar（1.0.0）已审核通过。'],
    ['REVIEW_REJECTED', '技能审核驳回', 'Calendar（1.0.0）审核未通过。'],
    ['PROMOTION_SUBMITTED', '技能推广提交', 'Calendar（1.0.0）已提交推广。'],
    ['PROMOTION_APPROVED', '技能推广通过', 'Calendar（1.0.0）推广已通过。'],
    ['PROMOTION_REJECTED', '技能推广驳回', 'Calendar（1.0.0）推广未通过。'],
    ['REPORT_SUBMITTED', '技能举报提交', 'Calendar 收到新的举报。'],
    ['REPORT_RESOLVED', '技能举报已处理', 'Calendar 的举报已处理。'],
    ['SKILL_PUBLISHED', '技能发布成功', 'Calendar（1.0.0）已发布。'],
    ['SUBSCRIPTION_NEW_VERSION', '订阅技能更新', 'Calendar（1.0.0）发布了新版本。'],
    ['SUBSCRIPTION_VERSION_YANKED', '订阅技能版本撤回', 'Calendar（1.0.0）版本已撤回。'],
  ])('renders %s with fixed Chinese copy', (eventType, title, description) => {
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
