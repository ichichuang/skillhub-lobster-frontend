import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', async () => {
  const actual = await vi.importActual<typeof import('react-i18next')>('react-i18next')
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => key,
      i18n: { resolvedLanguage: 'en' },
    }),
  }
})

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
  it('renders the fixed Chinese privacy policy even when i18n reports english', () => {
    const html = renderToStaticMarkup(<PrivacyPolicyPage />)

    expect(html).toContain('隐私政策')
    expect(html).toContain('本政策说明')
    expect(html).toContain('网页控制台')
    expect(html).toContain('API 令牌')
    expect(html).not.toContain('Privacy Policy')
    expect(html).not.toContain('This policy explains')
    expect(html).not.toContain('Web 控制台')
    expect(html).not.toContain('API Token')
  })
})
