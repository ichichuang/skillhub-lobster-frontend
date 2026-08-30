import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('lucide-react', () => ({
  Check: () => null,
  Copy: () => null,
  Settings: () => null,
  Download: () => null,
  Upload: () => null,
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}))

vi.mock('@/shared/lib/clipboard', () => ({
  useCopyToClipboard: () => [false, vi.fn()],
}))

vi.mock('@/shared/lib/registry-url', () => ({
  resolvePublicRegistryUrl: (configuredUrl: string | undefined, fallbackUrl: string) => configuredUrl ?? fallbackUrl,
}))

import { QuickStartSection } from './quick-start'

/**
 * QuickStartSection is a React component that renders a multi-step quick-start
 * guide with code blocks, copy buttons, and syntax-highlighted code lines.
 * Internal helpers (getAppBaseUrl, CodeLine, CodeBlock, CopyButton) are not exported.
 * There are no exported pure helpers or constants to test here.
 *
 * We verify the module shape so downstream consumers break fast
 * if the export contract changes.
 */
describe('QuickStartSection', () => {
  it('exports the QuickStartSection component', () => {
    expect(QuickStartSection).toBeTypeOf('function')
  })

  it('renders a Chinese landing quick-start eyebrow', () => {
    const html = renderToStaticMarkup(createElement(QuickStartSection, { variant: 'landing' }))

    expect(html).toContain('快速开始')
  })
})
