/** @vitest-environment jsdom */

import { createElement, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/client'
import type { PublishResult } from '@/api/types'

const testState = vi.hoisted(() => ({
  search: {} as Record<string, string>,
  selectedFiles: [] as File[],
  mutateAsync: vi.fn(),
  navigate: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => testState.navigate,
  useSearch: () => testState.search,
}))

vi.mock('react-i18next', async () => {
  const actual = await vi.importActual<typeof import('react-i18next')>('react-i18next')
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, values?: Record<string, unknown>) => {
        if (!values) return key
        return `${key}:${Object.values(values).join('/')}`
      },
    }),
  }
})

vi.mock('@/features/publish/upload-zone', () => ({
  UploadZone: ({
    onFilesSelect,
    disabled,
  }: {
    onFilesSelect: (files: File[]) => void
    disabled?: boolean
  }) => createElement('button', {
    type: 'button',
    'data-testid': 'upload-zone',
    disabled,
    onClick: () => onFilesSelect(testState.selectedFiles),
  }, 'upload.add'),
}))

vi.mock('@/shared/ui/select', () => ({
  Select: ({ children, value }: { children: ReactNode; value?: string }) => (
    createElement('div', { 'data-select-value': value }, children)
  ),
  SelectContent: ({ children }: { children: ReactNode }) => createElement('div', null, children),
  SelectItem: ({ children }: { children: ReactNode }) => createElement('span', null, children),
  SelectTrigger: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    createElement('button', { type: 'button', ...props }, children)
  ),
  SelectValue: () => null,
  normalizeSelectValue: (value: string) => value || undefined,
}))

vi.mock('@/shared/ui/card', () => ({
  Card: ({ children }: { children: ReactNode }) => createElement('div', null, children),
}))

vi.mock('@/shared/hooks/use-skill-queries', () => ({
  usePublishSkill: () => ({
    mutateAsync: testState.mutateAsync,
    isPending: false,
  }),
}))

vi.mock('@/shared/hooks/use-namespace-queries', () => ({
  useMyNamespaces: () => ({
    data: [{ id: 1, slug: 'team-ai', displayName: 'Team AI', type: 'TEAM' }],
    isLoading: false,
  }),
}))

vi.mock('@/shared/components/dashboard-page-header', () => ({
  DashboardPageHeader: () => null,
}))

vi.mock('@/shared/components/confirm-dialog', () => ({
  ConfirmDialog: ({
    open,
    title,
    description,
    onConfirm,
    onOpenChange,
  }: {
    open: boolean
    title: string
    description?: ReactNode
    onConfirm: () => void
    onOpenChange: (open: boolean) => void
  }) => open ? createElement(
    'div',
    { role: 'dialog', 'aria-label': title },
    description,
    createElement('button', { type: 'button', onClick: onConfirm }, 'confirm-warning'),
    createElement('button', { type: 'button', onClick: () => onOpenChange(false) }, 'cancel-warning'),
  ) : null,
}))

vi.mock('@/shared/lib/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { PublishPage } from './publish'
import { buildStoreZip, skillMdContent } from '@/features/publish/zip-test-builder'

function makeFile(name: string, lastModified: number, options?: { withoutSkillMd?: boolean }): File {
  const entries = options?.withoutSkillMd
    ? [{ path: 'README.md', content: '# package without SKILL.md' }]
    : [{ path: 'SKILL.md', content: skillMdContent(name.replace(/\.zip$/, ''), 'A valid test skill description', '1.0.0') }]
  const bytes = buildStoreZip(entries)
  return new File([bytes as BlobPart], name, { type: 'application/zip', lastModified })
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

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

beforeEach(() => {
  testState.search = { namespace: 'team-ai', visibility: 'private' }
  testState.selectedFiles = []
  testState.mutateAsync.mockReset()
  testState.navigate.mockReset()
})

afterEach(cleanup)

describe('PublishPage', () => {
  it('prefills the batch namespace and visibility from route search params', () => {
    render(createElement(PublishPage))

    expect(document.querySelector('#namespace')?.parentElement?.getAttribute('data-select-value')).toBe('team-ai')
    expect(document.querySelector('#visibility')?.parentElement?.getAttribute('data-select-value')).toBe('PRIVATE')
  })

  it('falls back to an empty namespace and public visibility when search params are missing', () => {
    testState.search = {}
    render(createElement(PublishPage))

    expect(document.querySelector('#namespace')?.parentElement?.getAttribute('data-select-value')).toBe('__select_namespace__')
    expect(document.querySelector('#visibility')?.parentElement?.getAttribute('data-select-value')).toBe('PUBLIC')
  })

  it('announces a resubmission from the review flow via search params', () => {
    testState.search = {
      namespace: 'team-ai',
      visibility: 'PUBLIC',
      resubmitSkill: 'memory-keeper',
      resubmitVersion: '1.0.0',
    }
    render(createElement(PublishPage))

    expect(screen.getByText('publish.resubmitNotice.title:@team-ai/memory-keeper/1.0.0')).toBeTruthy()
  })

  it('adds multiple files and removes an individual pending file', () => {
    testState.selectedFiles = [makeFile('alpha.zip', 1), makeFile('beta.zip', 2)]
    render(createElement(PublishPage))

    fireEvent.click(screen.getByTestId('upload-zone'))
    expect(screen.getByText(/alpha\.zip/)).toBeTruthy()
    expect(screen.getByText(/beta\.zip/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'publish.removeFile:alpha.zip' }))
    expect(screen.queryByText(/alpha\.zip/)).toBeNull()
    expect(screen.getByText(/beta\.zip/)).toBeTruthy()
  })

  it('locks batch controls, ignores repeated publish clicks, and stays on the page after completion', async () => {
    const first = deferred<PublishResult>()
    const second = deferred<PublishResult>()
    const files = [makeFile('one.zip', 1), makeFile('two.zip', 2)]
    testState.selectedFiles = files
    testState.mutateAsync
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise)
    render(createElement(PublishPage))

    fireEvent.click(screen.getByTestId('upload-zone'))
    const publishButton = screen.getByRole('button', { name: 'publish.confirm' })
    fireEvent.click(publishButton)
    fireEvent.click(publishButton)

    await waitFor(() => expect(testState.mutateAsync).toHaveBeenCalledTimes(1))
    expect((screen.getByTestId('upload-zone') as HTMLButtonElement).disabled).toBe(true)
    expect((document.querySelector('#namespace') as HTMLButtonElement).disabled).toBe(true)
    expect((document.querySelector('#visibility') as HTMLButtonElement).disabled).toBe(true)

    first.resolve(makeResult(files[0]))
    await waitFor(() => expect(testState.mutateAsync).toHaveBeenCalledTimes(2))
    expect(testState.mutateAsync.mock.calls[1]?.[0]).toMatchObject({
      namespace: 'team-ai',
      visibility: 'PRIVATE',
      file: files[1],
      confirmWarnings: false,
    })
    second.resolve(makeResult(files[1]))

    await screen.findByText('publish.batchSummary:2/0')
    expect(testState.navigate).not.toHaveBeenCalled()
    expect(screen.getAllByText('publish.status.succeeded')).toHaveLength(2)
  })

  it('cancels a warning for the correct file and continues the queue', async () => {
    const files = [makeFile('warning.zip', 1), makeFile('next.zip', 2)]
    const warning = new ApiError(
      'warning',
      400,
      'Pre-publish warnings require confirmation before publishing:\n- Review package scripts',
    )
    testState.selectedFiles = files
    testState.mutateAsync
      .mockRejectedValueOnce(warning)
      .mockResolvedValueOnce(makeResult(files[1]))
    render(createElement(PublishPage))

    fireEvent.click(screen.getByTestId('upload-zone'))
    fireEvent.click(screen.getByRole('button', { name: 'publish.confirm' }))

    const dialog = await screen.findByRole('dialog', { name: 'publish.warningConfirmTitle' })
    expect(dialog.textContent).toContain('warning.zip')
    fireEvent.click(screen.getByRole('button', { name: 'cancel-warning' }))

    await screen.findByText('publish.batchSummary:1/1')
    expect(testState.mutateAsync.mock.calls.map(([request]) => request.file.name)).toEqual([
      'warning.zip',
      'next.zip',
    ])
    expect(screen.getByText('publish.errorTypes.warningCancelledDescription')).toBeTruthy()
  })

  it.each([
    [new ApiError('timeout', 408), 'publish.timeoutTitle', 'publish.timeoutDescription'],
    [new ApiError('exists', 409, 'Version already exists'), 'publish.versionExistsTitle', 'publish.versionExistsDescription'],
    [new ApiError('frontmatter', 400, 'Invalid SKILL.md frontmatter'), 'publish.frontmatterFailedTitle', 'Invalid SKILL.md frontmatter'],
    [new ApiError('precheck', 400, 'Pre-publish validation failed: blocked'), 'publish.precheckFailedTitle', 'Pre-publish validation failed: blocked'],
  ])('renders the translated per-file error semantics for %s', async (error, title, description) => {
    testState.selectedFiles = [makeFile('failed.zip', 1)]
    testState.mutateAsync.mockRejectedValueOnce(error)
    render(createElement(PublishPage))

    fireEvent.click(screen.getByTestId('upload-zone'))
    fireEvent.click(screen.getByRole('button', { name: 'publish.confirm' }))

    await screen.findByText(title)
    expect(screen.getByText(description)).toBeTruthy()
  })

  it('previews the parsed skill name, description, and version before publishing', async () => {
    const description = 'A valid test skill description'
    testState.selectedFiles = [makeFile('alpha.zip', 1)]
    render(createElement(PublishPage))

    fireEvent.click(screen.getByTestId('upload-zone'))

    expect(await screen.findByText('alpha')).toBeTruthy()
    expect(screen.getByText(description)).toBeTruthy()
    expect(screen.getByText('1.0.0')).toBeTruthy()
    expect(screen.getByLabelText('publish.preflight.skillInfoTitle')).toBeTruthy()
    expect(screen.getByLabelText('publish.preflight.checksTitle')).toBeTruthy()
    expect(testState.mutateAsync).not.toHaveBeenCalled()
  })

  it('blocks a zip without a root SKILL.md before any publish request', async () => {
    testState.selectedFiles = [makeFile('broken.zip', 1, { withoutSkillMd: true })]
    render(createElement(PublishPage))

    fireEvent.click(screen.getByTestId('upload-zone'))

    expect(await screen.findByText('publish.preflight.skillMdMissing')).toBeTruthy()
    expect(screen.getByText('publish.status.blocked')).toBeTruthy()
    expect(screen.getByText('publish.preflight.frontmatterExample')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'publish.confirm' }) as HTMLButtonElement).disabled).toBe(true)
    expect(testState.mutateAsync).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'publish.removeFile:broken.zip' }))
    expect(screen.queryByText(/broken\.zip/)).toBeNull()
  })

  it('keeps a mixed batch usable and only publishes the valid files', async () => {
    const valid = makeFile('valid.zip', 1)
    testState.selectedFiles = [valid, makeFile('broken.zip', 2, { withoutSkillMd: true })]
    testState.mutateAsync.mockResolvedValueOnce(makeResult(valid))
    render(createElement(PublishPage))

    fireEvent.click(screen.getByTestId('upload-zone'))
    await screen.findByText('publish.status.blocked')

    const publishButton = screen.getByRole('button', { name: 'publish.confirm' }) as HTMLButtonElement
    expect(publishButton.disabled).toBe(false)
    fireEvent.click(publishButton)

    await screen.findByText('publish.batchSummary:1/0')
    expect(testState.mutateAsync).toHaveBeenCalledTimes(1)
    expect(testState.mutateAsync.mock.calls[0]?.[0].file.name).toBe('valid.zip')
    expect(screen.getByText('publish.status.blocked')).toBeTruthy()
    expect(screen.getAllByText('publish.status.succeeded')).toHaveLength(1)
  })

  it('renders the friendly copy when the server rejects with a duplicate preflight error', async () => {
    const file = makeFile('stale.zip', 1)
    testState.selectedFiles = [file]
    testState.mutateAsync.mockRejectedValueOnce(
      new ApiError('stale', 400, '技能包校验失败：Missing required file: SKILL.md at root'),
    )
    render(createElement(PublishPage))

    fireEvent.click(screen.getByTestId('upload-zone'))
    await screen.findByText('publish.preflight.passedNote')

    fireEvent.click(screen.getByRole('button', { name: 'publish.confirm' }))

    await screen.findByText('publish.preflight.skillMdErrorTitle')
    expect(screen.getByText('publish.preflight.skillMdMissing')).toBeTruthy()
    expect(screen.queryByText('技能包校验失败：Missing required file: SKILL.md at root')).toBeNull()
  })

  it('clears the queue for the next batch after a completed batch', async () => {
    const files = [makeFile('done.zip', 1), makeFile('reject.zip', 2)]
    testState.selectedFiles = files
    testState.mutateAsync
      .mockResolvedValueOnce(makeResult(files[0]))
      .mockRejectedValueOnce(new Error('boom'))
    render(createElement(PublishPage))

    fireEvent.click(screen.getByTestId('upload-zone'))
    fireEvent.click(screen.getByRole('button', { name: 'publish.confirm' }))
    await screen.findByText('publish.batchSummary:1/1')

    fireEvent.click(screen.getByRole('button', { name: 'publish.startAnotherBatch' }))
    expect(screen.queryByText(/done\.zip/)).toBeNull()
    expect(screen.queryByText('publish.batchSummary:1/1')).toBeNull()
  })

  it('exports a named component function', () => {
    expect(typeof PublishPage).toBe('function')
  })
})
