import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './card'

describe('Card components', () => {
  it('exports all card sub-components', () => {
    expect(Card).toBeDefined()
    expect(CardHeader).toBeDefined()
    expect(CardTitle).toBeDefined()
    expect(CardDescription).toBeDefined()
    expect(CardContent).toBeDefined()
    expect(CardFooter).toBeDefined()
  })

  it('sets displayName on all card sub-components', () => {
    expect(Card.displayName).toBe('Card')
    expect(CardHeader.displayName).toBe('CardHeader')
    expect(CardTitle.displayName).toBe('CardTitle')
    expect(CardDescription.displayName).toBe('CardDescription')
    expect(CardContent.displayName).toBe('CardContent')
    expect(CardFooter.displayName).toBe('CardFooter')
  })

  it('uses semantic card borders and shadows without inline color ownership', () => {
    const html = renderToStaticMarkup(createElement(Card))

    expect(html).toContain('border-border')
    expect(html).toContain('shadow-card')
    expect(html).not.toContain('style=')
  })
})
