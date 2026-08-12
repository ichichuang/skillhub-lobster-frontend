import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { SeverityBadge } from './severity-badge'
import type { FindingSeverity } from './types'

vi.mock('react-i18next', async () => {
  const actual = await vi.importActual<typeof import('react-i18next')>('react-i18next')
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => key,
      i18n: { language: 'en' },
    }),
  }
})

describe('SeverityBadge', () => {
  const severities: FindingSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']

  it.each(severities)('renders the translated label for %s severity', (severity) => {
    const html = renderToStaticMarkup(<SeverityBadge severity={severity} />)

    expect(html).toContain(`securityAudit.severity.${severity}`)
  })

  it('applies the semantic danger classes for CRITICAL severity', () => {
    const html = renderToStaticMarkup(<SeverityBadge severity="CRITICAL" />)

    expect(html).toContain('bg-danger-surface')
    expect(html).toContain('text-danger')
  })

  it('applies the semantic danger classes for HIGH severity', () => {
    const html = renderToStaticMarkup(<SeverityBadge severity="HIGH" />)

    expect(html).toContain('text-danger')
  })

  it('applies the semantic warning classes for MEDIUM severity', () => {
    const html = renderToStaticMarkup(<SeverityBadge severity="MEDIUM" />)

    expect(html).toContain('text-warning')
  })

  it('applies the semantic info classes for LOW severity', () => {
    const html = renderToStaticMarkup(<SeverityBadge severity="LOW" />)

    expect(html).toContain('text-info')
  })

  it('applies the semantic neutral classes for INFO severity', () => {
    const html = renderToStaticMarkup(<SeverityBadge severity="INFO" />)

    expect(html).toContain('text-muted-foreground')
  })

  it('renders as a span with rounded-full pill styling', () => {
    const html = renderToStaticMarkup(<SeverityBadge severity="LOW" />)

    expect(html).toContain('rounded-full')
    expect(html).toContain('text-xs')
    expect(html).toContain('font-medium')
  })
})
