import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as mod from './toaster'

/**
 * Toaster is a React component that wraps Sonner's Toaster with project-specific
 * positioning and styling. It uses CENTER_TOASTER_ID from @/shared/lib/toast.
 * There are no exported pure helpers or constants to test here.
 *
 * We verify the module shape so downstream consumers break fast
 * if the export contract changes.
 */
describe('toaster module exports', () => {
  it('exports the Toaster component', () => {
    expect(mod.Toaster).toBeTypeOf('function')
  })

  it('uses a Chinese accessible label for the notification region', () => {
    const html = renderToStaticMarkup(createElement(mod.Toaster))

    expect(html).toContain('aria-label="通知中心 alt+T"')
    expect(html).not.toContain('aria-label="Notifications alt+T"')
  })
})
