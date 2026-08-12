import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Textarea } from './textarea'

describe('Textarea component', () => {
  it('exports the Textarea component', () => {
    expect(Textarea).toBeDefined()
  })

  it('sets displayName', () => {
    expect(Textarea.displayName).toBe('Textarea')
  })

  it('uses semantic form-control tokens', () => {
    const html = renderToStaticMarkup(createElement(Textarea))

    expect(html).toContain('bg-input')
    expect(html).toContain('border-border')
    expect(html).toContain('placeholder:text-placeholder')
  })
})
