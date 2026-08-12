// @vitest-environment jsdom

import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PagedResponse, SkillSummary } from '@/api/types'

const fetchJsonMock = vi.fn()

vi.mock('@/api/client', () => ({
  fetchJson: (url: string) => fetchJsonMock(url),
  WEB_API_PREFIX: '/api/web',
}))

import {
  fetchLocalPublishedCatalog,
  fetchLocalPublishedLabelMembership,
  useLocalPublishedCatalog,
  useLocalPublishedLabelMembership,
} from './use-local-published-catalog'

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

function createPage(items: SkillSummary[], total: number, page: number): PagedResponse<SkillSummary> {
  return { items, total, page, size: 100 }
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('Local Published Catalog fetching', () => {
  beforeEach(() => {
    fetchJsonMock.mockReset()
  })

  it('consumes every Portal Search page and excludes non-published summaries from the catalog total', async () => {
    const firstPagePublished = Array.from({ length: 99 }, (_, index) => createSkill({
      id: index + 1,
      slug: `published-${index + 1}`,
    }))
    const stale = createSkill({ id: 100, slug: 'autonomous-execution', publishedVersion: undefined, resolutionMode: 'NONE' })
    const last = createSkill({ id: 101, slug: 'last-published' })
    fetchJsonMock
      .mockResolvedValueOnce(createPage([...firstPagePublished, stale], 101, 0))
      .mockResolvedValueOnce(createPage([last], 101, 1))

    const catalog = await fetchLocalPublishedCatalog()

    expect(fetchJsonMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/web/skills?sort=newest&page=0&size=100',
      '/api/web/skills?sort=newest&page=1&size=100',
    ])
    expect(catalog).toHaveLength(100)
    expect(catalog[catalog.length - 1]?.slug).toBe('last-published')
    expect(catalog.some((skill) => skill.slug === 'autonomous-execution')).toBe(false)
  })

  it('rejects an incomplete catalog after consuming every expected page', async () => {
    const first = createSkill({ id: 1, slug: 'first' })
    const last = createSkill({ id: 2, slug: 'last' })
    fetchJsonMock
      .mockResolvedValueOnce(createPage([first], 201, 0))
      .mockResolvedValueOnce(createPage([], 201, 1))
      .mockResolvedValueOnce(createPage([last], 201, 2))

    await expect(fetchLocalPublishedCatalog()).rejects.toThrow('before the reported total was collected')

    expect(fetchJsonMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/web/skills?sort=newest&page=0&size=100',
      '/api/web/skills?sort=newest&page=1&size=100',
      '/api/web/skills?sort=newest&page=2&size=100',
    ])
  })

  it('fetches every page for one label and returns normalized identity membership', async () => {
    const remainder = Array.from({ length: 98 }, (_, index) => createSkill({
      id: index + 2,
      slug: `label-member-${index + 2}`,
    }))
    fetchJsonMock
      .mockResolvedValueOnce(createPage([
        createSkill({ id: 1, namespace: '@Global', slug: 'First' }),
        ...remainder,
        createSkill({ id: 100, namespace: 'global', slug: 'autonomous-execution', publishedVersion: undefined }),
      ], 101, 0))
      .mockResolvedValueOnce(createPage([
        createSkill({ id: 101, namespace: 'team-ai', slug: 'second' }),
      ], 101, 1))

    const membership = await fetchLocalPublishedLabelMembership('operations')

    expect(fetchJsonMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/web/skills?label=operations&sort=newest&page=0&size=100',
      '/api/web/skills?label=operations&sort=newest&page=1&size=100',
    ])
    expect(membership).toHaveProperty('size', 101)
    expect(membership.has('global/first')).toBe(true)
    expect(membership.has('global/autonomous-execution')).toBe(true)
    expect(membership.has('team-ai/second')).toBe(true)
  })
})

describe('Local Published Catalog query caching', () => {
  beforeEach(() => {
    fetchJsonMock.mockReset()
  })

  it('reuses the same fresh complete catalog cache across consumers', async () => {
    fetchJsonMock.mockResolvedValue(createPage([createSkill()], 1, 0))
    const wrapper = createWrapper()

    const first = renderHook(() => useLocalPublishedCatalog(), { wrapper })
    await waitFor(() => expect(first.result.current.data).toHaveLength(1))

    const second = renderHook(() => useLocalPublishedCatalog(), { wrapper })
    await waitFor(() => expect(second.result.current.data).toHaveLength(1))

    expect(fetchJsonMock).toHaveBeenCalledTimes(1)
  })

  it('does not request label membership when no label is selected', async () => {
    const { result } = renderHook(() => useLocalPublishedLabelMembership(undefined), {
      wrapper: createWrapper(),
    })

    expect(result.current.fetchStatus).toBe('idle')
    expect(fetchJsonMock).not.toHaveBeenCalled()
  })

  it('keeps the same Label membership cache isolated between authenticated viewers', async () => {
    const firstViewerSkill = createSkill({ id: 1, namespace: 'team-a', slug: 'first' })
    const secondViewerSkill = createSkill({ id: 2, namespace: 'team-b', slug: 'second' })
    fetchJsonMock
      .mockResolvedValueOnce(createPage([firstViewerSkill], 1, 0))
      .mockResolvedValueOnce(createPage([secondViewerSkill], 1, 0))
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    const first = renderHook(() => useLocalPublishedLabelMembership('operations', 'user-a'), { wrapper })
    await waitFor(() => expect(first.result.current.data).toEqual(new Set(['team-a/first'])))
    const second = renderHook(() => useLocalPublishedLabelMembership('operations', 'user-b'), { wrapper })
    await waitFor(() => expect(second.result.current.data).toEqual(new Set(['team-b/second'])))
    const firstAgain = renderHook(() => useLocalPublishedLabelMembership('operations', 'user-a'), { wrapper })
    await waitFor(() => expect(firstAgain.result.current.data).toEqual(new Set(['team-a/first'])))

    expect(fetchJsonMock).toHaveBeenCalledTimes(2)
    expect(queryClient.getQueryData([
      'skills',
      'local-published-catalog',
      'label-membership',
      'viewer',
      'user-a',
      'operations',
    ])).toEqual(new Set(['team-a/first']))
  })
})
