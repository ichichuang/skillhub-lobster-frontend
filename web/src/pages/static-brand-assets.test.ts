import { describe, expect, it } from 'vitest'
import favicon from '../../public/favicon.svg?raw'

describe('static brand assets', () => {
  it('keeps the favicon graphical while removing the legacy letter mark and export metadata', () => {
    expect(favicon).toContain('<svg')
    expect(favicon).toContain('id="packageGradient"')
    expect(favicon).not.toContain('>S</text>')
    expect(favicon).not.toContain('SkillHubLogo')
  })
})
