import { describe, expect, it } from 'vitest'
import { slugifySkillName, validateSkillSlug } from './skill-slug'

describe('slugifySkillName', () => {
  it('mirrors the backend slug normalization', () => {
    expect(slugifySkillName('  My Cool Skill!  ')).toBe('my-cool-skill')
    expect(slugifySkillName('记忆助手')).toBe('记忆助手')
    expect(slugifySkillName('a  -- b')).toBe('a-b')
    expect(slugifySkillName('!!!')).toBe('')
  })
})

describe('validateSkillSlug', () => {
  it('accepts well-formed slugs including non-latin letters', () => {
    expect(validateSkillSlug('my-skill')).toBe('ok')
    expect(validateSkillSlug('记忆助手')).toBe('ok')
  })

  it('rejects blank slugs', () => {
    expect(validateSkillSlug('')).toBe('blank')
  })

  it('rejects slugs outside the 2–64 character range', () => {
    expect(validateSkillSlug('a')).toBe('length')
    expect(validateSkillSlug('a'.repeat(65))).toBe('length')
  })

  it('rejects reserved slugs', () => {
    expect(validateSkillSlug('admin')).toBe('reserved')
    expect(validateSkillSlug('global')).toBe('reserved')
  })

  it('rejects pattern violations and consecutive hyphens', () => {
    expect(validateSkillSlug('-abc')).toBe('pattern')
    expect(validateSkillSlug('ab--cd')).toBe('doubleHyphen')
  })
})
