import type { PublishResult } from '@/api/types'
import { ApiError } from '@/api/client'
import {
  extractPrecheckWarnings,
  isFrontmatterFailureMessage,
  isPrecheckConfirmationMessage,
  isPrecheckFailureMessage,
  isVersionExistsMessage,
} from './publish-error-utils'

export type PublishQueueStatus =
  | 'pending'
  | 'publishing'
  | 'succeeded'
  | 'failed'
  | 'warning-confirmation-required'

export type PublishErrorKind =
  | 'timeout'
  | 'version-exists'
  | 'precheck'
  | 'frontmatter'
  | 'generic'
  | 'warning-cancelled'

export interface PublishQueueError {
  kind: PublishErrorKind
  message: string
}

export interface PublishQueueItem {
  id: string
  file: File
  status: PublishQueueStatus
  result?: PublishResult
  error?: PublishQueueError
  warnings?: string[]
}

export interface PublishBatchRequest {
  namespace: string
  file: File
  visibility: string
  confirmWarnings: boolean
}

export type PublishBatchWarningDecision = 'confirm' | 'cancel'

interface RunPublishBatchOptions {
  items: PublishQueueItem[]
  namespace: string
  visibility: string
  publish: (request: PublishBatchRequest) => Promise<PublishResult>
  onItemsChange: (items: PublishQueueItem[]) => void
  requestWarningDecision: (item: PublishQueueItem) => Promise<PublishBatchWarningDecision>
}

export function getPublishFileId(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`
}

export function createPublishQueueItem(file: File): PublishQueueItem {
  return {
    id: getPublishFileId(file),
    file,
    status: 'pending',
  }
}

export function addFilesToPublishQueue(
  items: PublishQueueItem[],
  files: File[],
): PublishQueueItem[] {
  const identities = new Set(items.map((item) => item.id))
  const additions: PublishQueueItem[] = []

  for (const file of files) {
    const item = createPublishQueueItem(file)
    if (!identities.has(item.id)) {
      identities.add(item.id)
      additions.push(item)
    }
  }

  return [...items, ...additions]
}

export function removePendingPublishQueueItem(
  items: PublishQueueItem[],
  itemId: string,
): PublishQueueItem[] {
  return items.filter((item) => item.id !== itemId || item.status !== 'pending')
}

export function classifyPublishError(error: unknown): PublishQueueError {
  if (error instanceof ApiError) {
    const message = error.serverMessage || error.message
    if (error.status === 408) {
      return { kind: 'timeout', message }
    }
    if (isVersionExistsMessage(message)) {
      return { kind: 'version-exists', message }
    }
    if (isPrecheckFailureMessage(message)) {
      return { kind: 'precheck', message }
    }
    if (isFrontmatterFailureMessage(message)) {
      return { kind: 'frontmatter', message }
    }
    return { kind: 'generic', message }
  }

  return {
    kind: 'generic',
    message: error instanceof Error ? error.message : '',
  }
}

function replaceQueueItem(
  items: PublishQueueItem[],
  itemId: string,
  update: (item: PublishQueueItem) => PublishQueueItem,
): PublishQueueItem[] {
  return items.map((item) => item.id === itemId ? update(item) : item)
}

export async function runPublishBatch({
  items,
  namespace,
  visibility,
  publish,
  onItemsChange,
  requestWarningDecision,
}: RunPublishBatchOptions): Promise<PublishQueueItem[]> {
  let currentItems = [...items]

  const updateItem = (
    itemId: string,
    update: (item: PublishQueueItem) => PublishQueueItem,
  ) => {
    currentItems = replaceQueueItem(currentItems, itemId, update)
    onItemsChange(currentItems)
  }

  for (const queuedItem of items) {
    if (queuedItem.status !== 'pending') {
      continue
    }

    updateItem(queuedItem.id, (item) => ({
      ...item,
      status: 'publishing',
      error: undefined,
      warnings: undefined,
    }))

    try {
      const result = await publish({
        namespace,
        visibility,
        file: queuedItem.file,
        confirmWarnings: false,
      })
      updateItem(queuedItem.id, (item) => ({
        ...item,
        status: 'succeeded',
        result,
      }))
      continue
    } catch (error) {
      const message = error instanceof ApiError ? error.serverMessage || error.message : undefined
      if (!(error instanceof ApiError) || !isPrecheckConfirmationMessage(message)) {
        updateItem(queuedItem.id, (item) => ({
          ...item,
          status: 'failed',
          error: classifyPublishError(error),
        }))
        continue
      }

      const warningItem: PublishQueueItem = {
        ...currentItems.find((item) => item.id === queuedItem.id)!,
        status: 'warning-confirmation-required',
        warnings: extractPrecheckWarnings(message),
      }
      updateItem(queuedItem.id, () => warningItem)

      const decision = await requestWarningDecision(warningItem)
      if (decision === 'cancel') {
        updateItem(queuedItem.id, (item) => ({
          ...item,
          status: 'failed',
          error: { kind: 'warning-cancelled', message: '' },
        }))
        continue
      }

      updateItem(queuedItem.id, (item) => ({ ...item, status: 'publishing' }))
      try {
        const result = await publish({
          namespace,
          visibility,
          file: queuedItem.file,
          confirmWarnings: true,
        })
        updateItem(queuedItem.id, (item) => ({
          ...item,
          status: 'succeeded',
          result,
        }))
      } catch (retryError) {
        updateItem(queuedItem.id, (item) => ({
          ...item,
          status: 'failed',
          error: classifyPublishError(retryError),
        }))
      }
    }
  }

  return currentItems
}
