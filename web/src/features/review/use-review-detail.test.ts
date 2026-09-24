import { describe, expect, it, vi } from 'vitest'

// The use-review-detail module exports thin useQuery / useMutation wrappers
// (useReviewDetail, useReviewSkillDetail, useApproveReview, useRejectReview).
// Internal helper functions (getReviewDetail, getReviewSkillDetail, approveReview,
// rejectReview) are not exported and cannot be tested directly.
//
// Verifying that each public hook is exported and is a callable function serves as
// a smoke check that the module and its dependency graph resolve correctly.

const useQueryOptionsCapture: Array<Record<string, unknown>> = []

vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: Record<string, unknown>) => {
    useQueryOptionsCapture.push(options)
    return { data: undefined, isLoading: false, error: null }
  },
  useMutation: (options: Record<string, unknown>) => options,
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}))

vi.mock('@/api/client', () => ({
  reviewApi: {
    get: vi.fn(),
    getSkillDetail: vi.fn(),
    listAttempts: vi.fn(),
    approve: vi.fn(),
    reject: vi.fn(),
  },
}))

describe('use-review-detail exports', () => {
  it('exports useReviewDetail', async () => {
    const mod = await import('./use-review-detail')
    expect(mod.useReviewDetail).toBeDefined()
    expect(typeof mod.useReviewDetail).toBe('function')
  })

  it('exports useReviewSkillDetail', async () => {
    const mod = await import('./use-review-detail')
    expect(mod.useReviewSkillDetail).toBeDefined()
    expect(typeof mod.useReviewSkillDetail).toBe('function')
  })

  it('exports useReviewAttempts', async () => {
    const mod = await import('./use-review-detail')
    expect(mod.useReviewAttempts).toBeDefined()
    expect(typeof mod.useReviewAttempts).toBe('function')
  })

  it('exports useApproveReview', async () => {
    const mod = await import('./use-review-detail')
    expect(mod.useApproveReview).toBeDefined()
    expect(typeof mod.useApproveReview).toBe('function')
  })

  it('exports useRejectReview', async () => {
    const mod = await import('./use-review-detail')
    expect(mod.useRejectReview).toBeDefined()
    expect(typeof mod.useRejectReview).toBe('function')
  })

  it('owns review task errors in the page: detail, skill-detail, and attempts queries skip the global error toast', async () => {
    useQueryOptionsCapture.length = 0
    const mod = await import('./use-review-detail')

    mod.useReviewDetail(13)
    mod.useReviewSkillDetail(13, true)
    mod.useReviewAttempts(13)

    expect(useQueryOptionsCapture).toHaveLength(3)
    for (const options of useQueryOptionsCapture) {
      expect(options.meta).toMatchObject({ skipGlobalErrorHandler: true })
    }
    // The skill-detail query stays gated by its enabled argument.
    expect(useQueryOptionsCapture[1]?.enabled).toBe(true)
  })
})
