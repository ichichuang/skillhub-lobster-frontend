import { describe, expect, it, vi } from 'vitest'
import { fetchAllPagedItems } from './full-pagination'

describe('fetchAllPagedItems', () => {
  it('falls back to the safe complete-page size when a requested size cannot form a positive integer', async () => {
    const fetchPage = vi.fn().mockResolvedValue({ items: [], total: 0, page: 0, size: 100 })

    await fetchAllPagedItems(fetchPage, 0.5)

    expect(fetchPage).toHaveBeenCalledWith(0, 100)
  })

  it('rejects a non-finite total after one request instead of entering an unbounded loop', async () => {
    const fetchPage = vi.fn().mockResolvedValue({ items: [], total: Number.POSITIVE_INFINITY, page: 0, size: 100 })

    await expect(fetchAllPagedItems(fetchPage)).rejects.toThrow('finite non-negative')
    expect(fetchPage).toHaveBeenCalledTimes(1)
  })

  it('rejects after every expected page when the collected items do not satisfy the reported total', async () => {
    const fetchPage = vi.fn()
      .mockResolvedValueOnce({ items: ['first'], total: 201, page: 0, size: 100 })
      .mockResolvedValueOnce({ items: [], total: 201, page: 1, size: 100 })
      .mockResolvedValueOnce({ items: ['last'], total: 201, page: 2, size: 100 })

    await expect(fetchAllPagedItems(fetchPage)).rejects.toThrow('before the reported total was collected')
    expect(fetchPage).toHaveBeenCalledTimes(3)
  })
})
