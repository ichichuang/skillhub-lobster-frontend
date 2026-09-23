import { describe, expect, it } from 'vitest'
import indexHtml from '../../index.html?raw'

/**
 * The document shell is branding-owned: the downstream product title and the
 * repository-owned brand asset, while every upstream hardening declaration
 * (CSP, self-hosted fonts, translation guards, portal/runtime structure) stays
 * byte-for-byte intact.
 */
describe('index.html document branding', () => {
  it('uses the downstream product title 技能中心', () => {
    expect(indexHtml).toContain('<title>技能中心</title>')
    expect(indexHtml).not.toContain('<title>SkillHub</title>')
  })

  it('keeps the repository favicon reference', () => {
    expect(indexHtml).toContain('<link rel="icon" type="image/svg+xml" href="/favicon.svg" />')
  })

  it('preserves upstream hardening declarations', () => {
    expect(indexHtml).toContain('http-equiv="Content-Security-Policy"')
    expect(indexHtml).toContain('/fonts/fonts.css')
    expect(indexHtml).toContain('Self-hosted fonts')
    expect(indexHtml).toContain('translate="no"')
    expect(indexHtml).toContain('notranslate')
    expect(indexHtml).toContain('id="skillhub-portals"')
    expect(indexHtml).toContain('<script type="module" src="/src/bootstrap.ts"></script>')
  })

  it('does not regress the CSP security posture', () => {
    expect(indexHtml).toContain("frame-ancestors 'none'")
    expect(indexHtml).toContain("object-src 'none'")
  })
})
