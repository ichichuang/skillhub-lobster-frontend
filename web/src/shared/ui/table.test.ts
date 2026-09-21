/** @vitest-environment jsdom */

import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from './table'

describe('Table components', () => {
  it('exports all table sub-components', () => {
    expect(Table).toBeDefined()
    expect(TableHeader).toBeDefined()
    expect(TableBody).toBeDefined()
    expect(TableRow).toBeDefined()
    expect(TableHead).toBeDefined()
    expect(TableCell).toBeDefined()
  })

  it('sets displayName on all table sub-components', () => {
    expect(Table.displayName).toBe('Table')
    expect(TableHeader.displayName).toBe('TableHeader')
    expect(TableBody.displayName).toBe('TableBody')
    expect(TableRow.displayName).toBe('TableRow')
    expect(TableHead.displayName).toBe('TableHead')
    expect(TableCell.displayName).toBe('TableCell')
  })

  it('forwards wrapperClassName onto the scroll wrapper around the table element', () => {
    const { container, unmount } = render(
      createElement(
        Table,
        { wrapperClassName: 'min-h-0 flex-1' },
        createElement(TableHeader, null, createElement(TableRow, null, createElement(TableHead, null, '技能'))),
        createElement(TableBody, null, createElement(TableRow, null, createElement(TableCell, null, '行'))),
      ),
    )

    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.tagName).toBe('DIV')
    expect(wrapper.className).toContain('min-h-0')
    expect(wrapper.className).toContain('flex-1')
    expect(wrapper.className).toContain('overflow-auto')
    expect(wrapper.querySelector('table')).not.toBeNull()
    unmount()
    cleanup()
  })
})
