import { describe, expect, it } from 'vitest'
import type { SkillSummary } from '@/api/types'
import {
  createLandingCatalogSections,
  createLocalPublishedCatalog,
  createLocalPublishedSearchPage,
  createSkillIdentityKey,
} from './local-published-catalog'

function createSkill(overrides: Partial<SkillSummary> = {}): SkillSummary {
  return {
    id: 1,
    slug: 'published-skill',
    displayName: 'Published Skill',
    summary: 'A useful local skill',
    namespace: 'global',
    downloadCount: 10,
    starCount: 2,
    ratingCount: 0,
    updatedAt: '2026-03-20T00:00:00Z',
    canSubmitPromotion: false,
    publishedVersion: { id: 101, version: '1.0.0', status: 'PUBLISHED' },
    ...overrides,
  }
}

describe('createLocalPublishedCatalog', () => {
  it('keeps only summaries whose current published version is PUBLISHED', () => {
    const published = createSkill()
    const stale = createSkill({
      id: 2,
      slug: 'autonomous-execution',
      displayName: 'Autonomous Execution',
      publishedVersion: undefined,
      resolutionMode: 'NONE',
    })
    const uploaded = createSkill({
      id: 3,
      slug: 'uploaded-only',
      publishedVersion: { id: 103, version: '0.9.0', status: 'UPLOADED' },
    })

    expect(createLocalPublishedCatalog([stale, published, uploaded])).toEqual([published])
  })
})

describe('createLocalPublishedSearchPage', () => {
  it.each([
    ['display name', 'REPORT BUILDER', createSkill({ displayName: 'Report Builder' })],
    ['slug', 'release-helper', createSkill({ slug: 'release-helper' })],
    ['summary', 'KUBERNETES', createSkill({ summary: 'Automates Kubernetes rollouts' })],
    ['namespace', 'platform-team', createSkill({ namespace: 'platform-team' })],
  ])('matches a normalized case-insensitive query against %s', (_field, q, matchingSkill) => {
    const other = createSkill({ id: 9, slug: 'other', displayName: 'Other', summary: 'Different', namespace: 'global' })

    const result = createLocalPublishedSearchPage([other, matchingSkill], { q, page: 0, size: 12 })

    expect(result.items).toEqual([matchingSkill])
    expect(result.total).toBe(1)
  })

  it('applies namespace filtering locally after normalizing a leading at-sign', () => {
    const globalSkill = createSkill({ id: 1, namespace: 'global' })
    const teamSkill = createSkill({ id: 2, namespace: 'Team-AI', slug: 'team-skill' })

    const result = createLocalPublishedSearchPage([globalSkill, teamSkill], {
      namespace: '@team-ai',
      page: 0,
      size: 12,
    })

    expect(result.items).toEqual([teamSkill])
    expect(result.total).toBe(1)
  })

  it('intersects label membership with the eligible local catalog', () => {
    const included = createSkill({ id: 1, namespace: 'global', slug: 'included' })
    const excludedByLabel = createSkill({ id: 2, namespace: 'global', slug: 'excluded' })
    const stale = createSkill({
      id: 3,
      namespace: 'global',
      slug: 'autonomous-execution',
      publishedVersion: undefined,
    })
    const membership = new Set([
      createSkillIdentityKey(included),
      createSkillIdentityKey(stale),
      'global/label-only-stale-record',
    ])

    const result = createLocalPublishedSearchPage([included, excludedByLabel, stale], {
      labelMembership: membership,
      page: 0,
      size: 12,
    })

    expect(result.items).toEqual([included])
    expect(result.total).toBe(1)
  })

  it('computes total and pagination after q, namespace, and label intersection', () => {
    const matching = Array.from({ length: 13 }, (_, index) => createSkill({
      id: index + 1,
      slug: `matching-${index + 1}`,
      displayName: `Release Assistant ${index + 1}`,
      namespace: 'team-ai',
    }))
    const wrongNamespace = createSkill({ id: 50, slug: 'wrong-namespace', displayName: 'Release Assistant', namespace: 'global' })
    const wrongQuery = createSkill({ id: 51, slug: 'wrong-query', displayName: 'Meeting Notes', namespace: 'team-ai' })
    const stale = createSkill({ id: 52, slug: 'autonomous-execution', displayName: 'Release Assistant', namespace: 'team-ai', publishedVersion: undefined })
    const membership = new Set([
      ...matching.map(createSkillIdentityKey),
      createSkillIdentityKey(wrongNamespace),
      createSkillIdentityKey(wrongQuery),
      createSkillIdentityKey(stale),
    ])

    const result = createLocalPublishedSearchPage([...matching, wrongNamespace, wrongQuery, stale], {
      q: 'release',
      namespace: 'team-ai',
      labelMembership: membership,
      page: 1,
      size: 12,
    })

    expect(result.total).toBe(13)
    expect(result.page).toBe(1)
    expect(result.size).toBe(12)
    expect(result.items.map((skill) => skill.slug)).toEqual(['matching-13'])
  })
})

describe('createLandingCatalogSections', () => {
  it('sorts only eligible local catalog skills for popular and latest sections', () => {
    const olderPopular = createSkill({ id: 1, slug: 'older-popular', downloadCount: 50, updatedAt: '2026-01-01T00:00:00Z' })
    const newer = createSkill({ id: 2, slug: 'newer', downloadCount: 10, updatedAt: '2026-04-01T00:00:00Z' })
    const stale = createSkill({
      id: 3,
      slug: 'autonomous-execution',
      downloadCount: 999,
      updatedAt: '2026-12-01T00:00:00Z',
      publishedVersion: undefined,
    })

    const sections = createLandingCatalogSections([newer, stale, olderPopular], 6)

    expect(sections.popular.map((skill) => skill.slug)).toEqual(['older-popular', 'newer'])
    expect(sections.latest.map((skill) => skill.slug)).toEqual(['newer', 'older-popular'])
  })
})
