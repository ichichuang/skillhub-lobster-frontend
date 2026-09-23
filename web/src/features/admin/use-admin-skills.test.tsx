/** @vitest-environment jsdom */

import { createElement, type ReactNode } from 'react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor, cleanup } from '@testing-library/react'

const listSkillsMock = vi.fn()
const getSkillDetailMock = vi.fn()
const listVersionFilesMock = vi.fn()
const hideSkillMock = vi.fn()
const unhideSkillMock = vi.fn()
const deleteSkillByIdMock = vi.fn()

vi.mock('@/api/client', () => ({
  adminApi: {
    listSkills: (...args: unknown[]) => listSkillsMock(...args),
    getSkillDetail: (...args: unknown[]) => getSkillDetailMock(...args),
    listVersionFiles: (...args: unknown[]) => listVersionFilesMock(...args),
    hideSkill: (...args: unknown[]) => hideSkillMock(...args),
    unhideSkill: (...args: unknown[]) => unhideSkillMock(...args),
    deleteSkillById: (...args: unknown[]) => deleteSkillByIdMock(...args),
  },
  ApiError: class ApiError extends Error {
    serverMessageKey?: string
  },
}))

import {
  useAdminSkills,
  useAdminSkillDetail,
  useAdminVersionFiles,
  useHideSkill,
  useUnhideSkill,
  useHardDeleteSkill,
  useRestoreHiddenSkill,
} from './use-admin-skills'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
  const removeSpy = vi.spyOn(queryClient, 'removeQueries')
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
  return { wrapper, invalidateSpy, removeSpy, queryClient }
}

const samplePage = {
  items: [],
  total: 0,
  page: 0,
  size: 20,
}

describe('useAdminSkills inventory hooks', () => {
  beforeEach(() => {
    listSkillsMock.mockReset().mockResolvedValue(samplePage)
    getSkillDetailMock.mockReset().mockResolvedValue({
      skill: { id: 7, slug: 'demo-skill', hidden: false, status: 'ACTIVE' },
      summary: '技能介绍内容',
      versions: [],
    })
    listVersionFilesMock.mockReset().mockResolvedValue([])
    hideSkillMock.mockReset().mockResolvedValue(undefined)
    unhideSkillMock.mockReset().mockResolvedValue(undefined)
    deleteSkillByIdMock.mockReset().mockResolvedValue(undefined)
  })

  afterEach(() => {
    cleanup()
  })

  it('forwards q/status/hidden/label/page/size params to adminApi.listSkills', async () => {
    const { wrapper } = createWrapper()
    const params = { q: 'demo', status: 'ARCHIVED', hidden: true, label: 'official', page: 2, size: 5 }

    renderHook(() => useAdminSkills(params), { wrapper })

    await waitFor(() => expect(listSkillsMock).toHaveBeenCalledWith(params))
  })

  it('useAdminSkillDetail stays idle until enabled, then fetches the skill detail', async () => {
    const { wrapper } = createWrapper()
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useAdminSkillDetail(7, enabled),
      { wrapper, initialProps: { enabled: false } },
    )

    expect(result.current.fetchStatus).toBe('idle')
    expect(getSkillDetailMock).not.toHaveBeenCalled()

    rerender({ enabled: true })

    await waitFor(() => expect(getSkillDetailMock).toHaveBeenCalledWith(7))
    await waitFor(() => expect(result.current.data?.summary).toBe('技能介绍内容'))
  })

  it('useAdminVersionFiles stays idle until the files tab enables it', async () => {
    const { wrapper } = createWrapper()
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useAdminVersionFiles(7, 3, enabled),
      { wrapper, initialProps: { enabled: false } },
    )

    expect(result.current.fetchStatus).toBe('idle')
    expect(listVersionFilesMock).not.toHaveBeenCalled()

    rerender({ enabled: true })

    await waitFor(() => expect(listVersionFilesMock).toHaveBeenCalledWith(7, 3))
  })

  it('useHideSkill maps to adminApi.hideSkill and invalidates the inventory query', async () => {
    const { wrapper, invalidateSpy } = createWrapper()
    const { result } = renderHook(() => useHideSkill(), { wrapper })

    await result.current.mutateAsync({ skillId: 11 })

    expect(hideSkillMock).toHaveBeenCalledWith(11)
    expect(unhideSkillMock).not.toHaveBeenCalled()
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['admin', 'skills'] }),
    )
  })

  it('useUnhideSkill maps to adminApi.unhideSkill and invalidates the inventory query', async () => {
    const { wrapper, invalidateSpy } = createWrapper()
    const { result } = renderHook(() => useUnhideSkill(), { wrapper })

    await result.current.mutateAsync({ skillId: 12 })

    expect(unhideSkillMock).toHaveBeenCalledWith(12)
    expect(hideSkillMock).not.toHaveBeenCalled()
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['admin', 'skills'] }),
    )
  })

  it('useHideSkill does not invalidate when the mutation fails', async () => {
    hideSkillMock.mockRejectedValue(new Error('forbidden'))
    const { wrapper, invalidateSpy } = createWrapper()
    const { result } = renderHook(() => useHideSkill(), { wrapper })

    await expect(result.current.mutateAsync({ skillId: 13 })).rejects.toThrow('forbidden')

    expect(invalidateSpy).not.toHaveBeenCalled()
  })

  it('useHardDeleteSkill removes the deleted detail/files caches and invalidates only list queries', async () => {
    const { wrapper, invalidateSpy, removeSpy, queryClient } = createWrapper()
    queryClient.setQueryData(['admin', 'skills', 'detail', 14], { summary: '旧详情' })
    queryClient.setQueryData(['admin', 'skills', 'files', 14, 3], [{ id: 1 }])
    const { result } = renderHook(() => useHardDeleteSkill(), { wrapper })

    await result.current.mutateAsync({ skillId: 14 })

    expect(deleteSkillByIdMock).toHaveBeenCalledTimes(1)
    expect(deleteSkillByIdMock).toHaveBeenCalledWith(14)
    expect(hideSkillMock).not.toHaveBeenCalled()
    // The deleted resource's caches are gone so no post-delete refetch can 404.
    expect(queryClient.getQueryData(['admin', 'skills', 'detail', 14])).toBeUndefined()
    expect(queryClient.getQueryData(['admin', 'skills', 'files', 14, 3])).toBeUndefined()
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['admin', 'skills'],
        predicate: expect.any(Function),
      }),
    )
    const invalidateCall = invalidateSpy.mock.calls.find((call) => call[0]?.predicate)
    const rawPredicate = invalidateCall?.[0]?.predicate
    if (!rawPredicate) {
      throw new Error('expected a predicate-based invalidateQueries call')
    }
    const predicate = rawPredicate as unknown as (query: { queryKey: unknown[] }) => boolean
    expect(predicate({ queryKey: ['admin', 'skills', { page: 0 }] })).toBe(true)
    expect(predicate({ queryKey: ['admin', 'skills', { q: '演示', hidden: true }] })).toBe(true)
    expect(predicate({ queryKey: ['admin', 'skills', 'detail', 14] })).toBe(false)
    expect(predicate({ queryKey: ['admin', 'skills', 'files', 14, 3] })).toBe(false)
    expect(removeSpy).toHaveBeenCalled()
  })

  it('useHardDeleteSkill does not touch caches when the mutation fails', async () => {
    deleteSkillByIdMock.mockRejectedValue(new Error('conflict'))
    const { wrapper, invalidateSpy, queryClient } = createWrapper()
    queryClient.setQueryData(['admin', 'skills', 'detail', 15], { summary: '详情' })
    const { result } = renderHook(() => useHardDeleteSkill(), { wrapper })

    await expect(result.current.mutateAsync({ skillId: 15 })).rejects.toThrow('conflict')

    expect(invalidateSpy).not.toHaveBeenCalled()
    expect(queryClient.getQueryData(['admin', 'skills', 'detail', 15])).toEqual({ summary: '详情' })
  })

  it('keeps the upstream useRestoreHiddenSkill behavior intact', async () => {
    const { wrapper, invalidateSpy } = createWrapper()
    const { result } = renderHook(() => useRestoreHiddenSkill(), { wrapper })

    await result.current.mutateAsync(21)

    expect(unhideSkillMock).toHaveBeenCalledWith(21)
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['skills'] }),
    )
  })
})
