import { describe, expect, it } from 'vitest'
import { ApiError } from '@/shared/lib/api-error'
import { isReviewTaskMissingError, resolveReviewActionErrorDescription } from './review-error'

describe('resolveReviewActionErrorDescription', () => {
  it('returns the error message when present', () => {
    expect(resolveReviewActionErrorDescription(new Error('审核规则校验失败'))).toBe('审核规则校验失败')
  })

  it('returns undefined for blank or non-error values', () => {
    expect(resolveReviewActionErrorDescription(new Error('   '))).toBeUndefined()
    expect(resolveReviewActionErrorDescription('审核失败')).toBeUndefined()
  })
})

describe('isReviewTaskMissingError', () => {
  it('detects the review_task.not_found server message key', () => {
    const error = new ApiError('审核任务不存在或已被撤销：13', 404, '审核任务不存在或已被撤销：13', 'review_task.not_found')
    expect(isReviewTaskMissingError(error)).toBe(true)
  })

  it('detects any 404 response on review endpoints', () => {
    const error = new ApiError('HTTP 404', 404)
    expect(isReviewTaskMissingError(error)).toBe(true)
  })

  it('does not treat other api errors as missing tasks', () => {
    expect(isReviewTaskMissingError(new ApiError('安全扫描仍在进行中', 400))).toBe(false)
    expect(isReviewTaskMissingError(new ApiError('server error', 500))).toBe(false)
  })

  it('does not treat plain errors or non-errors as missing tasks', () => {
    expect(isReviewTaskMissingError(new Error('review_task.not_found'))).toBe(false)
    expect(isReviewTaskMissingError('review_task.not_found')).toBe(false)
    expect(isReviewTaskMissingError(null)).toBe(false)
  })
})
