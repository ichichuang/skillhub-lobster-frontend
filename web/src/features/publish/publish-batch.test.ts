import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/client'
import type { PublishResult } from '@/api/types'
import {
  addFilesToPublishQueue,
  classifyPublishError,
  createPublishQueueItem,
  removePendingPublishQueueItem,
  runPublishBatch,
  type PublishBatchWarningDecision,
} from './publish-batch'

function makeFile(name: string, size = 8, lastModified = 1): File {
  return new File([new Uint8Array(size)], name, {
    type: 'application/zip',
    lastModified,
  })
}

function makeResult(file: File): PublishResult {
  return {
    skillId: file.lastModified,
    namespace: 'team-ai',
    slug: file.name.replace(/\.zip$/, ''),
    version: '1.0.0',
    status: 'PUBLISHED',
    fileCount: 1,
    totalSize: file.size,
  }
}

describe('publish queue operations', () => {
  it('adds multiple ZIP files and ignores duplicate local identities across selections', () => {
    const first = makeFile('alpha.zip', 8, 10)
    const duplicate = makeFile('alpha.zip', 8, 10)
    const second = makeFile('beta.zip', 9, 11)

    const initial = addFilesToPublishQueue([], [first, second])
    const withDuplicate = addFilesToPublishQueue(initial, [duplicate])

    expect(withDuplicate.map((item) => item.file)).toEqual([first, second])
    expect(withDuplicate.map((item) => item.status)).toEqual(['pending', 'pending'])
  })

  it('removes an individual pending file before publishing', () => {
    const first = createPublishQueueItem(makeFile('alpha.zip'))
    const second = createPublishQueueItem(makeFile('beta.zip'))

    expect(removePendingPublishQueueItem([first, second], first.id)).toEqual([second])
  })

  it('does not remove a non-pending queue item', () => {
    const item = {
      ...createPublishQueueItem(makeFile('active.zip')),
      status: 'publishing' as const,
    }

    expect(removePendingPublishQueueItem([item], item.id)).toEqual([item])
  })
})

describe('runPublishBatch', () => {
  it('publishes three queued ZIPs in strict sequence with no concurrent requests', async () => {
    const files = [
      makeFile('one.zip', 8, 1),
      makeFile('two.zip', 8, 2),
      makeFile('three.zip', 8, 3),
    ]
    const queue = files.map(createPublishQueueItem)
    const events: string[] = []
    let activeRequests = 0
    let maximumActiveRequests = 0
    const publish = vi.fn(async ({ file }: { file: File }) => {
      events.push(`start:${file.name}`)
      activeRequests += 1
      maximumActiveRequests = Math.max(maximumActiveRequests, activeRequests)
      await Promise.resolve()
      activeRequests -= 1
      events.push(`finish:${file.name}`)
      return makeResult(file)
    })

    const result = await runPublishBatch({
      items: queue,
      namespace: 'team-ai',
      visibility: 'PRIVATE',
      publish,
      onItemsChange: vi.fn(),
      requestWarningDecision: vi.fn(),
    })

    expect(events).toEqual([
      'start:one.zip',
      'finish:one.zip',
      'start:two.zip',
      'finish:two.zip',
      'start:three.zip',
      'finish:three.zip',
    ])
    expect(maximumActiveRequests).toBe(1)
    expect(publish.mock.calls.map(([params]) => params)).toEqual(files.map((file) => ({
      namespace: 'team-ai',
      visibility: 'PRIVATE',
      file,
      confirmWarnings: false,
    })))
    expect(result.map((item) => item.status)).toEqual(['succeeded', 'succeeded', 'succeeded'])
    expect(result.map((item) => item.result?.slug)).toEqual(['one', 'two', 'three'])
  })

  it('records a normal failure on file 2 and continues publishing file 3', async () => {
    const files = [
      makeFile('one.zip', 8, 1),
      makeFile('two.zip', 8, 2),
      makeFile('three.zip', 8, 3),
    ]
    const publish = vi.fn(async ({ file }: { file: File }) => {
      if (file.name === 'two.zip') {
        throw new Error('network unavailable')
      }
      return makeResult(file)
    })

    const result = await runPublishBatch({
      items: files.map(createPublishQueueItem),
      namespace: 'team-ai',
      visibility: 'PUBLIC',
      publish,
      onItemsChange: vi.fn(),
      requestWarningDecision: vi.fn(),
    })

    expect(publish).toHaveBeenCalledTimes(3)
    expect(result.map((item) => item.status)).toEqual(['succeeded', 'failed', 'succeeded'])
    expect(result[1]?.error).toEqual({ kind: 'generic', message: 'network unavailable' })
    expect(result[2]?.result?.slug).toBe('three')
  })

  it('pauses on the warning file and confirms a retry only for that file', async () => {
    const files = [makeFile('one.zip', 8, 1), makeFile('two.zip', 8, 2)]
    const warning = new ApiError(
      'warning',
      400,
      'Pre-publish warnings require confirmation before publishing:\n- Review package scripts',
    )
    const publish = vi.fn(async ({ file, confirmWarnings }: { file: File; confirmWarnings?: boolean }) => {
      if (file.name === 'one.zip' && confirmWarnings !== true) {
        throw warning
      }
      return makeResult(file)
    })
    const warningStatuses: string[][] = []
    const requestWarningDecision = vi.fn(async (): Promise<PublishBatchWarningDecision> => 'confirm')

    const result = await runPublishBatch({
      items: files.map(createPublishQueueItem),
      namespace: 'team-ai',
      visibility: 'NAMESPACE_ONLY',
      publish,
      onItemsChange: (items) => warningStatuses.push(items.map((item) => item.status)),
      requestWarningDecision,
    })

    expect(warningStatuses).toContainEqual(['warning-confirmation-required', 'pending'])
    expect(requestWarningDecision).toHaveBeenCalledWith(expect.objectContaining({
      file: files[0],
      status: 'warning-confirmation-required',
      warnings: ['Review package scripts'],
    }))
    expect(publish.mock.calls.map(([params]) => ({
      file: params.file.name,
      confirmWarnings: params.confirmWarnings,
    }))).toEqual([
      { file: 'one.zip', confirmWarnings: false },
      { file: 'one.zip', confirmWarnings: true },
      { file: 'two.zip', confirmWarnings: false },
    ])
    expect(result.map((item) => item.status)).toEqual(['succeeded', 'succeeded'])
  })

  it('marks a cancelled warning file failed and continues remaining files', async () => {
    const files = [makeFile('one.zip', 8, 1), makeFile('two.zip', 8, 2)]
    const warning = new ApiError(
      'warning',
      400,
      'Pre-publish warnings require confirmation before publishing:\n- Review package scripts',
    )
    const publish = vi.fn(async ({ file }: { file: File }) => {
      if (file.name === 'one.zip') {
        throw warning
      }
      return makeResult(file)
    })

    const result = await runPublishBatch({
      items: files.map(createPublishQueueItem),
      namespace: 'team-ai',
      visibility: 'PUBLIC',
      publish,
      onItemsChange: vi.fn(),
      requestWarningDecision: async () => 'cancel',
    })

    expect(publish.mock.calls.map(([params]) => params.file.name)).toEqual(['one.zip', 'two.zip'])
    expect(result[0]?.status).toBe('failed')
    expect(result[0]?.error).toEqual({ kind: 'warning-cancelled', message: '' })
    expect(result[1]?.status).toBe('succeeded')
  })
})

describe('classifyPublishError', () => {
  it.each([
    [new ApiError('timeout', 408), 'timeout'],
    [new ApiError('exists', 409, 'Version already exists'), 'version-exists'],
    [new ApiError('frontmatter', 400, 'Invalid SKILL.md frontmatter'), 'frontmatter'],
    [new ApiError('precheck', 400, 'Pre-publish validation failed: blocked'), 'precheck'],
  ] as const)('preserves the %s classification', (error, kind) => {
    expect(classifyPublishError(error).kind).toBe(kind)
  })
})
