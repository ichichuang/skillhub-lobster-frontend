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
  it('navigates by path when the return target has no query', () => {
    expect(buildReturnToNavigation('/dashboard/skills')).toEqual({
      to: '/dashboard/skills',
      search: undefined,
    })
  })

  it('passes the return query through search so the router revalidates it', () => {
    expect(buildReturnToNavigation('/search?q=demo&sort=newest&page=2')).toEqual({
      to: '/search',
      search: { q: 'demo', sort: 'newest', page: '2' },
    })
  })

  it('omits globally retained keys so retainSearchParams re-adds them with parsed types', () => {
    expect(buildReturnToNavigation('/dashboard/skills?embed=true&dark=1')).toEqual({
      to: '/dashboard/skills',
      search: undefined,
    })
  })
})
