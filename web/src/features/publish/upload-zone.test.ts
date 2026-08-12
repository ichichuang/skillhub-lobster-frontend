/** @vitest-environment jsdom */

import { fireEvent, render, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { UploadZone } from './upload-zone'

/**
 * upload-zone.tsx exports the UploadZone component. It is a stateless
 * dropzone wrapper with no exported constants, validation logic, or
 * helper functions.
 *
 * We verify the export contract so downstream consumers break fast if
 * the module shape changes.
 */
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

describe('UploadZone', () => {
  it('exports the UploadZone component', () => {
    expect(UploadZone).toBeDefined()
    expect(typeof UploadZone).toBe('function')
  })

  it('accepts multiple ZIP files from one selection', async () => {
    const onFilesSelect = vi.fn()
    const { container } = render(createElement(UploadZone, { onFilesSelect }))
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    const files = [
      new File(['one'], 'one.zip', { type: 'application/zip' }),
      new File(['two'], 'two.zip', { type: 'application/zip' }),
    ]

    fireEvent.change(input, { target: { files } })

    expect(input.multiple).toBe(true)
    expect(input.accept).toContain('.zip')
    await waitFor(() => expect(onFilesSelect).toHaveBeenCalledWith(files))
  })

  it('disables the native file input while the batch is locked', () => {
    const { container } = render(createElement(UploadZone, {
      onFilesSelect: vi.fn(),
      disabled: true,
    }))

    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    expect(input.disabled).toBe(true)
  })
})
