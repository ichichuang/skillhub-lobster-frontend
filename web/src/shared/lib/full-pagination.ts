import type { PagedResponse } from '@/api/types'

export const COMPLETE_PAGE_SIZE = 100

const MAX_COMPLETE_PAGE_COUNT = 10_000

function normalizePageSize(value: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback
  }
  const normalized = Math.floor(value)
  return normalized > 0 ? normalized : fallback
}

/**
 * Loads a server-reported paged result completely while keeping malformed responses bounded.
 */
export async function fetchAllPagedItems<T>(
  fetchPage: (page: number, size: number) => Promise<PagedResponse<T>>,
  requestedPageSize = COMPLETE_PAGE_SIZE,
): Promise<T[]> {
  const pageSize = normalizePageSize(requestedPageSize, COMPLETE_PAGE_SIZE)
  const items: T[] = []
  let page = 0

  while (page < MAX_COMPLETE_PAGE_COUNT) {
    const response = await fetchPage(page, pageSize)
    if (!Array.isArray(response.items)) {
      throw new Error('Paged response items must be an array')
    }
    if (!Number.isFinite(response.total) || response.total < 0) {
      throw new Error('Paged response total must be a finite non-negative number')
    }

    items.push(...response.items)
    const total = Math.floor(response.total)
    if (total === 0 || items.length >= total) {
      return items
    }

    const responsePageSize = normalizePageSize(response.size, pageSize)
    const expectedPageCount = Math.ceil(total / responsePageSize)
    if (expectedPageCount > MAX_COMPLETE_PAGE_COUNT) {
      throw new Error('Paged response exceeds the safe complete-fetch limit')
    }
    if (page + 1 >= expectedPageCount) {
      throw new Error('Paged response ended before the reported total was collected')
    }

    page += 1
  }

  throw new Error('Paged response did not complete within the safe page limit')
}
