import { describe, expect, it } from 'vitest'
import { buildReturnToNavigation, getSkillSquareSearch, getSkillLabelSearch, normalizeSkillDetailReturnTo } from './skill-navigation'

describe('getSkillSquareSearch', () => {
  it('returns the default search params for the skill square', () => {
    expect(getSkillSquareSearch()).toEqual({
      q: '',
      sort: 'relevance',
      page: 0,
      starredOnly: false,
    })
  })
})

describe('getSkillLabelSearch', () => {
  it('returns search params that filter by the given label', () => {
    expect(getSkillLabelSearch('code-generation')).toEqual({
      q: '',
      label: 'code-generation',
      sort: 'newest',
      page: 0,
      starredOnly: false,
    })
  })
})

describe('normalizeSkillDetailReturnTo', () => {
  it('returns the provided dashboard route when coming from my skills', () => {
    expect(normalizeSkillDetailReturnTo('/dashboard/skills')).toBe('/dashboard/skills')
  })

  it('drops invalid return targets', () => {
    expect(normalizeSkillDetailReturnTo('https://example.com/elsewhere')).toBeUndefined()
  })
})

describe('buildReturnToNavigation', () => {
  it('splits path and query into router navigation options', () => {
    expect(buildReturnToNavigation('/search?q=demo&sort=newest')).toEqual({
      to: '/search',
      search: { q: 'demo', sort: 'newest' },
    })
  })

  it('strips globally retained integration keys from the nested query', () => {
    expect(buildReturnToNavigation('/dashboard/skills?embed=true&dark=1&page=2')).toEqual({
      to: '/dashboard/skills',
      search: { page: '2' },
    })
  })

  it('omits search entirely when only integration keys were present', () => {
    expect(buildReturnToNavigation('/dashboard?embed=true&showHeader=1&dark=1')).toEqual({
      to: '/dashboard',
      search: undefined,
    })
  })

  it('decodes the nested query into plain search values for the router', () => {
    expect(buildReturnToNavigation('/search?q=%E6%BC%94%E7%A4%BA&label=official')).toEqual({
      to: '/search',
      search: { q: '演示', label: 'official' },
    })
  })
})
