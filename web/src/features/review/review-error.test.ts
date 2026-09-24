import { describe, expect, it } from 'vitest'
import { ApiError } from '@/shared/lib/api-error'
import {
  isReviewScanFailedError,
  isReviewTaskMissingError,
  resolveReviewActionErrorDescription,
} from './review-error'

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
    const error = new ApiError('评审任务不存在或已被撤回/替换：13', 404, '评审任务不存在或已被撤回/替换：13', 'review_task.not_found')
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

  it('keeps authorization failures distinct from stale tasks', () => {
    expect(isReviewTaskMissingError(new ApiError('review.no_permission', 403, 'review.no_permission'))).toBe(false)
  })

  it('does not treat plain errors or non-errors as missing tasks', () => {
    expect(isReviewTaskMissingError(new Error('review_task.not_found'))).toBe(false)
    expect(isReviewTaskMissingError('review_task.not_found')).toBe(false)
    expect(isReviewTaskMissingError(null)).toBe(false)
  })
})

describe('isReviewScanFailedError', () => {
  it('detects the review.approve.scan_failed server message key', () => {
    const error = new ApiError('review.approve.scan_failed', 400, 'review.approve.scan_failed', 'review.approve.scan_failed')
    expect(isReviewScanFailedError(error)).toBe(true)
  })

  it('detects the localized server copy in every supported locale', () => {
    expect(isReviewScanFailedError(new ApiError(
      '安全扫描未通过，重新扫描成功前暂不能通过审核', 400,
      '安全扫描未通过，重新扫描成功前暂不能通过审核',
    ))).toBe(true)
    expect(isReviewScanFailedError(new ApiError(
      'Security scan failed. Approval is unavailable until a successful rescan completes.', 400,
      'Security scan failed. Approval is unavailable until a successful rescan completes.',
    ))).toBe(true)
    expect(isReviewScanFailedError(new ApiError(
      'Проверка безопасности не пройдена. Одобрение недоступно до успешного повторного сканирования.', 400,
      'Проверка безопасности не пройдена. Одобрение недоступно до успешного повторного сканирования.',
    ))).toBe(true)
  })

  it('does not treat scanning-in-progress, stale tasks, or generic errors as scan failures', () => {
    expect(isReviewScanFailedError(new ApiError('扫描中', 400, '扫描中', 'review.approve.scan_in_progress'))).toBe(false)
    expect(isReviewScanFailedError(new ApiError('安全扫描进行中，暂不能通过审核', 400, '安全扫描进行中，暂不能通过审核'))).toBe(false)
    expect(isReviewScanFailedError(new ApiError('HTTP 404', 404))).toBe(false)
    expect(isReviewScanFailedError(new Error('review.approve.scan_failed'))).toBe(false)
    expect(isReviewScanFailedError(null)).toBe(false)
  })
})
