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

function makeFile(name: string, lastModified: number): File {
  return new File(['zip'], name, { type: 'application/zip', lastModified })
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

  it('exports a named component function', () => {
    expect(typeof PublishPage).toBe('function')
  })
})
