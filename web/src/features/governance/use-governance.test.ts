import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GOVERNANCE_PAGE_SIZE } from './use-governance'

// The use-governance module exports thin useQuery / useMutation wrappers around
// governanceApi. The Lobster governance surface must hide the promotion
// workflow: every inbox/notifications query used by the governance page carries
// the server-side exclusion parameters (exclude=PROMOTION /
// excludeCategory=PROMOTION) so pagination and totals stay server-accurate.
// These tests capture the TanStack Query options to pin that wiring.

const useQueryOptionsCapture: Array<Record<string, unknown>> = []

vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: Record<string, unknown>) => {
    useQueryOptionsCapture.push(options)
    return { data: undefined, isLoading: false, error: null }
  },
  useMutation: (options: Record<string, unknown>) => options,
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}))

const governanceApiMock = vi.hoisted(() => ({
  getSummary: vi.fn(),
  getInbox: vi.fn(),
  getActivity: vi.fn(),
  getNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  rebuildSearchIndex: vi.fn(),
}))

vi.mock('@/api/client', () => ({
  governanceApi: governanceApiMock,
}))

import {
  useGovernanceInbox,
  useGovernanceNotifications,
} from './use-governance'

describe('GOVERNANCE_PAGE_SIZE', () => {
  it('defaults to 10 items per page', () => {
    expect(GOVERNANCE_PAGE_SIZE).toBe(10)
  })

  it('is a positive integer', () => {
    expect(Number.isInteger(GOVERNANCE_PAGE_SIZE)).toBe(true)
    expect(GOVERNANCE_PAGE_SIZE).toBeGreaterThan(0)
  })
})

describe('governance promotion exclusion wiring', () => {
  beforeEach(() => {
    useQueryOptionsCapture.length = 0
    governanceApiMock.getInbox.mockReset()
    governanceApiMock.getNotifications.mockReset()
  })

  it('includes the inbox exclusion in the query key and request', async () => {
    governanceApiMock.getInbox.mockResolvedValue({ items: [], total: 0, page: 0, size: 10 })

    useGovernanceInbox('REVIEW', 0, GOVERNANCE_PAGE_SIZE, 'PROMOTION')

    expect(useQueryOptionsCapture).toHaveLength(1)
    const options = useQueryOptionsCapture[0]!
    expect(options.queryKey).toEqual(['governance', 'inbox', 'REVIEW', 'PROMOTION', 0, GOVERNANCE_PAGE_SIZE])

    await (options.queryFn as () => Promise<unknown>)()
    expect(governanceApiMock.getInbox).toHaveBeenCalledWith({
      type: 'REVIEW',
      exclude: 'PROMOTION',
      page: 0,
      size: GOVERNANCE_PAGE_SIZE,
    })
  })

  it('keeps pagination and refetch on the excluded query identity', async () => {
    useGovernanceInbox(undefined, 0, GOVERNANCE_PAGE_SIZE, 'PROMOTION')
    useGovernanceInbox(undefined, 1, GOVERNANCE_PAGE_SIZE, 'PROMOTION')

    expect(useQueryOptionsCapture).toHaveLength(2)
    expect(useQueryOptionsCapture[0]!.queryKey).toEqual(['governance', 'inbox', 'ALL', 'PROMOTION', 0, GOVERNANCE_PAGE_SIZE])
    expect(useQueryOptionsCapture[1]!.queryKey).toEqual(['governance', 'inbox', 'ALL', 'PROMOTION', 1, GOVERNANCE_PAGE_SIZE])
  })

  it('distinguishes excluded and non-excluded inbox queries in the cache key', () => {
    useGovernanceInbox(undefined, 0, GOVERNANCE_PAGE_SIZE, 'PROMOTION')
    useGovernanceInbox(undefined, 0, GOVERNANCE_PAGE_SIZE)

    expect(useQueryOptionsCapture).toHaveLength(2)
    const keys = useQueryOptionsCapture.map((options) => options.queryKey)
    expect(keys[0]).not.toEqual(keys[1])
    expect(keys[0]).toEqual(['governance', 'inbox', 'ALL', 'PROMOTION', 0, GOVERNANCE_PAGE_SIZE])
    expect(keys[1]).toEqual(['governance', 'inbox', 'ALL', 'NONE', 0, GOVERNANCE_PAGE_SIZE])
  })

  it('includes the governance notification exclusion in the query key and request', async () => {
    governanceApiMock.getNotifications.mockResolvedValue({ items: [], total: 0, page: 0, size: 10 })

    useGovernanceNotifications(0, GOVERNANCE_PAGE_SIZE, 'PROMOTION')

    expect(useQueryOptionsCapture).toHaveLength(1)
    const options = useQueryOptionsCapture[0]!
    expect(options.queryKey).toEqual(['governance', 'notifications', 'PROMOTION', 0, GOVERNANCE_PAGE_SIZE])

    await (options.queryFn as () => Promise<unknown>)()
    expect(governanceApiMock.getNotifications).toHaveBeenCalledWith({
      excludeCategory: 'PROMOTION',
      page: 0,
      size: GOVERNANCE_PAGE_SIZE,
    })
  })

  it('keeps excluded and non-excluded governance notification queries distinct', () => {
    useGovernanceNotifications(2, GOVERNANCE_PAGE_SIZE, 'PROMOTION')
    useGovernanceNotifications(2, GOVERNANCE_PAGE_SIZE)

    expect(useQueryOptionsCapture).toHaveLength(2)
    const keys = useQueryOptionsCapture.map((options) => options.queryKey)
    expect(keys[0]).toEqual(['governance', 'notifications', 'PROMOTION', 2, GOVERNANCE_PAGE_SIZE])
    expect(keys[1]).toEqual(['governance', 'notifications', 'NONE', 2, GOVERNANCE_PAGE_SIZE])
  })
})

// The remaining hook exports (useGovernanceSummary, useGovernanceActivity,
// useMarkGovernanceNotificationRead, useRebuildSearchIndex) are thin useQuery /
// useMutation wrappers with no custom data transformation logic. Testing them
// would only verify TanStack Query internals, so they are intentionally skipped
// in favour of integration or E2E coverage.
