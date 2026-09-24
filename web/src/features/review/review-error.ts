import { ApiError } from '@/shared/lib/api-error'

export function resolveReviewActionErrorDescription(error: unknown): string | undefined {
  if (!(error instanceof Error)) {
    return undefined
  }

  const message = error.message.trim()
  return message || undefined
}

/**
 * A pending review task can be legitimately deleted while a moderator still has
 * the detail page open (author withdraws, or republishes which auto-withdraws
 * the old submission). Detect that case so the UI can show a dedicated
 * stale-review state instead of surfacing the raw backend error.
 */
export function isReviewTaskMissingError(error: unknown): boolean {
  if (!(error instanceof ApiError)) {
    return false
  }
  return error.status === 404 || error.serverMessageKey === 'review_task.not_found'
}

/**
 * The backend rejects approval while the reviewed version failed its security
 * scan. The error envelope carries the localized server copy (the raw key only
 * when the bundle is missing), so this matches both the canonical key and the
 * known localized texts, mirroring the publish error-marker convention.
 */
const REVIEW_SCAN_FAILED_MARKERS = [
  'review.approve.scan_failed',
  // messages_zh.properties
  '安全扫描未通过',
  // messages.properties
  'Security scan failed',
  // messages_ru.properties
  'Проверка безопасности не пройдена',
]

export function isReviewScanFailedError(error: unknown): boolean {
  if (!(error instanceof ApiError)) {
    return false
  }
  const message = error.serverMessage || error.message
  if (!message) {
    return false
  }
  return REVIEW_SCAN_FAILED_MARKERS.some((marker) => message.includes(marker))
}
