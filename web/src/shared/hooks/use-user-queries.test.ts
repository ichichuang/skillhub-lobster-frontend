// @vitest-environment jsdom

import { createElement, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PagedResponse, SkillSummary } from '@/api/types'

const getSkillsMock = vi.fn()

vi.mock('@/api/client', () => ({
  meApi: {
    getSkills: (params: Record<string, unknown>) => getSkillsMock(params),
    getStars: vi.fn(),
    getStarsPage: vi.fn(),
    getSubscriptions: vi.fn(),
    getSubscriptionsPage: vi.fn(),
  },
  namespaceApi: {
    getDetail: vi.fn(),
  },
  promotionApi: {
    submit: vi.fn(),
  },
}))

interface CompletePublishedParams {
  q?: string
  namespace?: string
}

type CompletePublishedFetcher = (params?: CompletePublishedParams) => Promise<SkillSummary[]>
type CompletePublishedHook = (
  params?: CompletePublishedParams,
  enabled?: boolean,
) => { data?: SkillSummary[]; fetchStatus: string }

function createSkill(overrides: Partial<SkillSummary> = {}): SkillSummary {
  return {
    id: 1,
    slug: 'published-skill',
    displayName: 'Published Skill',
    summary: 'A useful owned skill',
    namespace: 'global',
    downloadCount: 10,
    starCount: 2,
    ratingCount: 0,
    updatedAt: '2026-08-11T00:00:00Z',
    canSubmitPromotion: false,
    publishedVersion: { id: 101, version: '1.0.0', status: 'PUBLISHED' },
    ...overrides,
  }
}

function createPage(items: SkillSummary[], total: number, page: number): PagedResponse<SkillSummary> {
  return { items, total, page, size: 100 }
}

async function loadCompletePublishedApi() {
  const mod = await import('./use-user-queries')
  const fetcher = Reflect.get(mod, 'fetchAllMyPublishedSkills')
  const hook = Reflect.get(mod, 'useAllMyPublishedSkills')

  expect(fetcher).toBeTypeOf('function')
  expect(hook).toBeTypeOf('function')

  return {
    fetcher: fetcher as CompletePublishedFetcher,
    hook: hook as CompletePublishedHook,
  }
}

function createQueryWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe('use-user-queries exports', () => {
  it('exports all expected hook functions', async () => {
    const mod = await import('./use-user-queries')
    expect(typeof mod.useMySkills).toBe('function')
    expect(typeof mod.useMyStars).toBe('function')
    expect(typeof mod.useMyStarsPage).toBe('function')
    expect(typeof mod.useSubmitPromotion).toBe('function')
  })
})

describe('complete owned Published skills', () => {
  beforeEach(() => {
    getSkillsMock.mockReset()
  })

  it('fetches every server-reported page with PUBLISHED, q, and namespace fixed', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => createSkill({
      id: index + 1,
      slug: `release-${index + 1}`,
      namespace: 'team-ai',
    }))
    const lastSkill = createSkill({ id: 101, slug: 'release-101', namespace: 'team-ai' })
    getSkillsMock
      .mockResolvedValueOnce(createPage(firstPage, 101, 0))
      .mockResolvedValueOnce(createPage([lastSkill], 101, 1))

    const { fetcher } = await loadCompletePublishedApi()
    const result = await fetcher({ q: 'release', namespace: 'team-ai' })

    expect(getSkillsMock.mock.calls.map(([params]) => params)).toEqual([
      { page: 0, size: 100, filter: 'PUBLISHED', q: 'release', namespace: 'team-ai' },
      { page: 1, size: 100, filter: 'PUBLISHED', q: 'release', namespace: 'team-ai' },
    ])
    expect(result).toHaveLength(101)
    expect(result[100]?.slug).toBe('release-101')
  })

  it('rejects an incomplete server result after consuming every expected page', async () => {
    const firstSkill = createSkill({ id: 1, slug: 'first' })
    const lastSkill = createSkill({ id: 2, slug: 'last' })
    getSkillsMock
      .mockResolvedValueOnce(createPage([firstSkill], 201, 0))
      .mockResolvedValueOnce(createPage([], 201, 1))
      .mockResolvedValueOnce(createPage([lastSkill], 201, 2))

    const { fetcher } = await loadCompletePublishedApi()
    await expect(fetcher()).rejects.toThrow('before the reported total was collected')

    expect(getSkillsMock).toHaveBeenCalledTimes(3)
  })

  it('does not request complete Published candidates when the query is disabled', async () => {
    const { hook } = await loadCompletePublishedApi()
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { result } = renderHook(() => hook({ q: 'release', namespace: 'team-ai' }, false), {
      wrapper: createQueryWrapper(queryClient),
    })

    expect(result.current.fetchStatus).toBe('idle')
    expect(getSkillsMock).not.toHaveBeenCalled()
  })

  it('caches complete candidates by q and namespace under the skills hierarchy', async () => {
    const skill = createSkill({ namespace: 'team-ai' })
    getSkillsMock.mockResolvedValue(createPage([skill], 1, 0))
    const { hook } = await loadCompletePublishedApi()
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = createQueryWrapper(queryClient)
    const params = { q: 'release', namespace: 'team-ai' }

    const first = renderHook(() => hook(params), { wrapper })
    await waitFor(() => expect(first.result.current.data).toEqual([skill]))
    const second = renderHook(() => hook(params), { wrapper })
    await waitFor(() => expect(second.result.current.data).toEqual([skill]))

    expect(getSkillsMock).toHaveBeenCalledTimes(1)
    expect(queryClient.getQueryData(['skills', 'my', 'published-complete', params])).toEqual([skill])
  })
})
