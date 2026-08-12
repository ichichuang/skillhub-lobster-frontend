import { describe, expect, it } from 'vitest'
import {
  APP_HEADER_BASE_CLASS_NAME,
  APP_HEADER_ELEVATED_CLASS_NAME,
  getAppHeaderClassName,
} from './layout-header-style'

describe('getAppHeaderClassName', () => {
  it('keeps the header flat before the page starts scrolling', () => {
    expect(getAppHeaderClassName(false)).not.toContain(APP_HEADER_ELEVATED_CLASS_NAME)
  })

  it('adds a subtle drop shadow after the header becomes sticky', () => {
    expect(getAppHeaderClassName(true)).toContain(APP_HEADER_ELEVATED_CLASS_NAME)
  })

  it('uses semantic shell colors and elevation', () => {
    expect(APP_HEADER_BASE_CLASS_NAME).toContain('bg-background/90')
    expect(APP_HEADER_BASE_CLASS_NAME).toContain('border-border')
    expect(APP_HEADER_BASE_CLASS_NAME).not.toContain('bg-white')
    expect(APP_HEADER_ELEVATED_CLASS_NAME).toBe('shadow-popover')
  })
})
