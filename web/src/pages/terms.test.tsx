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

import { TermsOfServicePage } from './terms'

describe('TermsOfServicePage', () => {
  it('renders the localized terms of service in the default Simplified Chinese', () => {
    const html = renderToStaticMarkup(<TermsOfServicePage />)

    expect(html).toContain('服务条款')
    expect(html).toContain('本条款适用于')
    expect(html).toContain('API 令牌')
    expect(html).toContain('1. 接受条款与适用范围')
    expect(html).not.toContain('terms.sections')
  })

  it('renders English terms when the runtime language is en', async () => {
    await i18n.changeLanguage('en')
    try {
      const html = renderToStaticMarkup(<TermsOfServicePage />)

      expect(html).toContain('Terms of Service')
      expect(html).toContain('These terms apply')
      expect(html).toContain('1. Acceptance of Terms and Scope')
      expect(html).not.toContain('服务条款')
    } finally {
      await i18n.changeLanguage('zh-CN')
    }
  })
})
