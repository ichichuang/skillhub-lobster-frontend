import { describe, expect, it } from 'vitest'
import { INPUT_BASE_CLASS_NAME } from './input'

describe('INPUT_BASE_CLASS_NAME', () => {
  it('uses semantic input, border, and placeholder tokens', () => {
    expect(INPUT_BASE_CLASS_NAME).toContain('bg-input')
    expect(INPUT_BASE_CLASS_NAME).toContain('border-border')
    expect(INPUT_BASE_CLASS_NAME).toContain('placeholder:text-placeholder')
    expect(INPUT_BASE_CLASS_NAME).not.toContain('bg-white')
  })
})
