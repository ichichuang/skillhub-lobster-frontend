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
