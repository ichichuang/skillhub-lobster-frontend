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

import { TermsOfServicePage } from './terms'

describe('TermsOfServicePage', () => {
  it('renders the fixed Chinese terms of service even when i18n reports english', () => {
    const html = renderToStaticMarkup(<TermsOfServicePage />)

    expect(html).toContain('服务条款')
    expect(html).toContain('本条款适用于')
    expect(html).toContain('API 令牌')
    expect(html).not.toContain('Terms of Service')
    expect(html).not.toContain('These terms apply')
    expect(html).not.toContain('API Token')
  })
})
