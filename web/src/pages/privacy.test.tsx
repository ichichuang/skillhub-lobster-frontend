import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import i18n from '@/i18n/config'

vi.mock('@/shared/components/legal-document', () => ({
  LegalDocument: (props: { title: string; summary: string; sections: unknown }) => (
    <div>
      <h1>{props.title}</h1>
      <p>{props.summary}</p>
      <pre>{JSON.stringify(props.sections)}</pre>
    </div>
  ),
}))

import { PrivacyPolicyPage } from './privacy'

describe('PrivacyPolicyPage', () => {
  it('renders the localized privacy policy in the default Simplified Chinese', () => {
    const html = renderToStaticMarkup(<PrivacyPolicyPage />)

    expect(html).toContain('隐私政策')
    expect(html).toContain('本政策说明')
    expect(html).toContain('网页控制台')
    expect(html).toContain('API 令牌')
    expect(html).toContain('1. 适用范围')
    expect(html).not.toContain('privacy.sections')
  })

  it('renders the English privacy policy when the runtime language is en', async () => {
    await i18n.changeLanguage('en')
    try {
      const html = renderToStaticMarkup(<PrivacyPolicyPage />)

      expect(html).toContain('Privacy Policy')
      expect(html).toContain('This policy explains')
      expect(html).toContain('1. Scope')
      expect(html).not.toContain('隐私政策')
    } finally {
      await i18n.changeLanguage('zh-CN')
    }
  })
})
