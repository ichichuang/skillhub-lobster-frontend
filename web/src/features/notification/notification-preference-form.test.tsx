// @vitest-environment jsdom

import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NotificationPreferenceItem } from '@/api/types'

const preferencesMock = vi.fn()
const updatePreferencesMock = vi.fn()

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock('./use-notification-preferences', () => ({
  useNotificationPreferences: () => preferencesMock(),
  useUpdateNotificationPreferences: () => ({ mutate: updatePreferencesMock, isPending: false }),
}))

import { NotificationPreferenceForm } from './notification-preference-form'

function serverPreferences(promotionEnabled: boolean): NotificationPreferenceItem[] {
  return [
    { category: 'PUBLISH', channel: 'IN_APP', enabled: true },
    { category: 'REVIEW', channel: 'IN_APP', enabled: true },
    { category: 'PROMOTION', channel: 'IN_APP', enabled: promotionEnabled },
    { category: 'REPORT', channel: 'IN_APP', enabled: true },
  ]
}

describe('NotificationPreferenceForm Lobster category surface', () => {
  afterEach(() => cleanup())
  beforeEach(() => {
    preferencesMock.mockReset()
    updatePreferencesMock.mockClear()
  })

  it('renders no Promotion preference control', () => {
    preferencesMock.mockReturnValue({ data: serverPreferences(true), isLoading: false })

    const { container } = render(<NotificationPreferenceForm />)

    expect(container.querySelector('#pref-toggle-PROMOTION')).toBeNull()
    expect(container.textContent).not.toContain('notification.preferences.promotion')
    expect(container.textContent).not.toContain('notification.preferences.promotionDesc')
  })

  it('keeps every non-Promotion preference control', () => {
    preferencesMock.mockReturnValue({ data: serverPreferences(true), isLoading: false })

    const { container } = render(<NotificationPreferenceForm />)

    expect(container.querySelector('#pref-toggle-PUBLISH')).not.toBeNull()
    expect(container.querySelector('#pref-toggle-REVIEW')).not.toBeNull()
    expect(container.querySelector('#pref-toggle-REPORT')).not.toBeNull()
  })

  it('leaves the hidden stored Promotion preference untouched when saving another category', () => {
    preferencesMock.mockReturnValue({ data: serverPreferences(true), isLoading: false })
    const { container } = render(<NotificationPreferenceForm />)

    fireEvent.click(container.querySelector('#pref-toggle-REPORT')!)

    expect(updatePreferencesMock).toHaveBeenCalledTimes(1)
    const payload = updatePreferencesMock.mock.calls[0][0] as NotificationPreferenceItem[]
    const promotion = payload.find((item) => item.category === 'PROMOTION')
    expect(promotion).toEqual({ category: 'PROMOTION', channel: 'IN_APP', enabled: true })
    expect(payload.find((item) => item.category === 'REPORT')?.enabled).toBe(false)
  })

  it('round-trips a disabled stored Promotion preference without resetting it', () => {
    preferencesMock.mockReturnValue({ data: serverPreferences(false), isLoading: false })
    const { container } = render(<NotificationPreferenceForm />)

    fireEvent.click(container.querySelector('#pref-toggle-PUBLISH')!)

    const payload = updatePreferencesMock.mock.calls[0][0] as NotificationPreferenceItem[]
    const promotion = payload.find((item) => item.category === 'PROMOTION')
    expect(promotion).toEqual({ category: 'PROMOTION', channel: 'IN_APP', enabled: false })
    expect(payload.find((item) => item.category === 'PUBLISH')?.enabled).toBe(false)
  })
})
