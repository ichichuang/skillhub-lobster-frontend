/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UploadZone } from './upload-zone'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

describe('upload-zone module exports', () => {
  afterEach(cleanup)

  it('exports the UploadZone component', () => {
    expect(UploadZone).toBeDefined()
    expect(typeof UploadZone).toBe('function')
  })

  it('accepts multiple ZIP files from one selection', async () => {
    const onFilesSelect = vi.fn()
    const { container } = render(createElement(UploadZone, { onFilesSelect }))
    const input = container.querySelector('input[type="file"][accept*=".zip"]') as HTMLInputElement
    const files = [
      new File(['one'], 'one.zip', { type: 'application/zip' }),
      new File(['two'], 'two.zip', { type: 'application/zip' }),
    ]

    fireEvent.change(input, { target: { files } })

    expect(input.multiple).toBe(true)
    expect(input.accept).toContain('.zip')
    await waitFor(() => expect(onFilesSelect).toHaveBeenCalledWith(files))
  })

  it('disables the native file inputs while the batch is locked', () => {
    const { container } = render(createElement(UploadZone, {
      onFilesSelect: vi.fn(),
      disabled: true,
    }))

    const inputs = Array.from(container.querySelectorAll('input[type="file"]')) as HTMLInputElement[]
    expect(inputs.length).toBeGreaterThan(0)
    for (const input of inputs) {
      expect(input.disabled).toBe(true)
    }
  })

  it('hides directory selection when the browser does not expose a directory picker', () => {
    render(createElement(UploadZone, { onFilesSelect: vi.fn(), onFolderSelect: vi.fn() }))
    expect(screen.queryByRole('button', { name: 'upload.folderHint' })).toBeNull()
  })

  it('shows directory selection only when the browser supports it', async () => {
    const previous = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'webkitdirectory')
    Object.defineProperty(HTMLInputElement.prototype, 'webkitdirectory', {
      configurable: true,
      writable: true,
      value: false,
    })
    try {
      render(createElement(UploadZone, { onFilesSelect: vi.fn(), onFolderSelect: vi.fn() }))
      await waitFor(() => expect(
        screen.getByRole('button', { name: 'upload.folderHint' })
      ).not.toBeNull())
    } finally {
      if (previous) Object.defineProperty(HTMLInputElement.prototype, 'webkitdirectory', previous)
      else delete (HTMLInputElement.prototype as { webkitdirectory?: boolean }).webkitdirectory
    }
  })
})
