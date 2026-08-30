import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import en from './locales/en.json'
import zh from './locales/zh.json'

const copyState = vi.hoisted(() => ({ copied: false }))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: () => '' }),
}))

vi.mock('@/shared/lib/clipboard', () => ({
  useCopyToClipboard: () => [copyState.copied, vi.fn()],
}))

vi.mock('@/shared/lib/registry-url', () => ({
  resolvePublicRegistryUrl: (configuredUrl?: string, fallbackUrl?: string) => configuredUrl || fallbackUrl || '',
}))

import { LandingQuickStartSection } from '../shared/components/landing-quick-start'
import { QuickStartSection } from '../shared/components/quick-start'

function leafValues(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(leafValues)
  if (value && typeof value === 'object') return Object.values(value).flatMap(leafValues)
  return []
}

function leafKeys(value: unknown, prefix = ''): string[] {
  if (typeof value === 'string') return [prefix]
  if (Array.isArray(value)) return value.flatMap((item, index) => leafKeys(item, `${prefix}.${index}`))
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, nestedValue]) => leafKeys(nestedValue, prefix ? `${prefix}.${key}` : key))
  }
  return []
}

describe('fixed zh-CN first-party visible copy', () => {
  it('uses Chinese names for naturally translatable product UI terms', () => {
    const visibleCopy = leafValues(zh).join('\n')

    expect(visibleCopy).not.toContain('SkillHub')
    expect(visibleCopy).not.toMatch(/Quick Start|Human|Dashboard|\bToken\b|\bSlug\b|\bSecondary\b|Merge Request|Verification Token|\bSkills\b|\bAgent\b|\bOwner\b|\bAdmin\b|\bMember\b/)
    expect(zh.landing.quickStart.tabs.agent).toBe('我是智能体')
    expect(zh.landing.quickStart.tabs.human).toBe('我是用户')
    expect(zh.dashboard.title).toBe('控制台')
    expect(zh.createToken.title).toBe('创建 API 令牌')
    expect(zh.adminLabels.formSlug).toBe('标识')
    expect(zh.accounts.secondaryLabel).toBe('待合并账号标识')
    expect(zh.accounts.mergeRequestId).toBe('合并请求 ID')
    expect(zh.accounts.verificationToken).toBe('验证令牌')
    expect(zh.landing.featuresList.versionControl.description).toBe(
      '语义化版本控制，自定义标签（测试版、稳定版），自动追踪最新版本。',
    )
    expect(zh.landing.quickStart.agent.command).toContain('终端或 Exec')
    expect(zh.landing.quickStart.agent.commandTemplate).toContain('终端或 Exec')
    expect(zh.myNamespaces.createDisplayNamePlaceholder).toBe('例如机器学习团队')
    expect(zh.adminLabels.formTranslationsHint).toBe('至少提供一组语言区域和显示名称。')
    expect(zh.adminLabels.translationLocalePlaceholder).toBe('语言区域，例如 en 或 zh-CN')
    expect(zh.adminLabels.validationTranslationsDescription).toBe('至少需要一组完整的语言区域和显示名称。')
    expect(zh.adminLabels.validationDuplicateLocaleDescription).toBe('同一个语言区域只能出现一次。')
    expect(zh.members.batchValidationInvalidRole).toBe('角色无效（必须为 MEMBER 或 ADMIN）')
    expect(zh.auditLog.filterCompatPublish).toBe('兼容层发布')
    expect(zh.skillDetail.deleteSkillInputDescription).toBe('请输入技能标识“{{slug}}”后继续。')
    expect(zh.skillDetail.deleteSkillInputPlaceholder).toBe('输入技能标识')
    expect(zh.securityAudit.scanDuration).toBe('{{seconds}} 秒')
  })

  it('removes the first-party brand from English resource values too', () => {
    expect(leafValues(en).join('\n')).not.toContain('SkillHub')
  })

  it('uses Chinese copy-button fallbacks when a translation is unavailable', () => {
    copyState.copied = false
    const uncopiedLanding = renderToStaticMarkup(createElement(LandingQuickStartSection, { onSearch: () => undefined }))
    const uncopiedQuickStart = renderToStaticMarkup(createElement(QuickStartSection))

    expect(uncopiedLanding).toContain('aria-label="复制"')
    expect(uncopiedLanding).toContain('title="复制"')
    expect(uncopiedQuickStart).toContain('title="复制"')
    expect(uncopiedQuickStart).toContain('>复制<')

    copyState.copied = true
    const copiedLanding = renderToStaticMarkup(createElement(LandingQuickStartSection, { onSearch: () => undefined }))
    const copiedQuickStart = renderToStaticMarkup(createElement(QuickStartSection))

    expect(copiedLanding).toContain('aria-label="已复制"')
    expect(copiedLanding).toContain('title="已复制"')
    expect(copiedQuickStart).toContain('title="已复制"')
    expect(copiedQuickStart).toContain('>已复制<')
  })

  it('keeps locale resources aligned without removed footer or legacy install keys', () => {
    for (const locale of [zh, en]) {
      expect(locale).not.toHaveProperty('layout')
      expect(locale).not.toHaveProperty('footer')
      expect(locale.skillDetail).not.toHaveProperty('installMethodSkillhub')
      expect(locale.skillDetail.installGuide).not.toHaveProperty('otherMethods')
      expect(locale.skillDetail.installGuide).not.toHaveProperty('skillhubCliDescription')
    }

    expect(leafKeys(zh).sort()).toEqual(leafKeys(en).sort())
  })
})
