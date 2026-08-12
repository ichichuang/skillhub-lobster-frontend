import { describe, expect, it } from 'vitest'

import {
  NOTIFICATION_DROPDOWN_CLASS_NAME,
  NOTIFICATION_ITEM_CLASS_NAME,
} from './notification-dropdown'

describe('notification dropdown theme contract', () => {
  it('uses semantic floating-surface and interaction tokens', () => {
    expect(NOTIFICATION_DROPDOWN_CLASS_NAME).toContain('bg-popover')
    expect(NOTIFICATION_DROPDOWN_CLASS_NAME).toContain('border-border')
    expect(NOTIFICATION_DROPDOWN_CLASS_NAME).toContain('shadow-popover')
    expect(NOTIFICATION_DROPDOWN_CLASS_NAME).not.toContain('bg-white')
    expect(NOTIFICATION_ITEM_CLASS_NAME).toContain('hover:bg-surface-hover')
    expect(NOTIFICATION_ITEM_CLASS_NAME).not.toContain('gray')
  })
})
