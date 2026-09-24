import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const originalWindow = globalThis.window
const originalDocument = globalThis.document

function setMockWindow(runtimeConfig?: Window['__SKILLHUB_RUNTIME_CONFIG__']) {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    writable: true,
    value: {
      __SKILLHUB_RUNTIME_CONFIG__: runtimeConfig,
    } satisfies Pick<Window, '__SKILLHUB_RUNTIME_CONFIG__'>,
  })
}

// Mock i18n before importing client
vi.mock('@/i18n/config', () => ({
  default: { resolvedLanguage: 'en' },
}))

// Mock api-error before importing client
vi.mock('@/shared/lib/api-error', () => ({
  ApiError: class ApiError extends Error {
    status: number
    serverMessage?: string
    serverMessageKey?: string
    constructor(message: string, status: number, serverMessage?: string, serverMessageKey?: string) {
      super(message)
      this.status = status
      this.serverMessage = serverMessage
      this.serverMessageKey = serverMessageKey
    }
  },
  handleApiError: vi.fn(),
}))

import {
  WEB_API_PREFIX,
  buildApiUrl,
  fetchText,
  getAppBaseUrl,
  getDirectAuthRuntimeConfig,
  getSessionBootstrapRuntimeConfig,
  governanceApi,
  namespaceApi,
  notificationApi,
} from './client'

beforeEach(() => {
  setMockWindow()
})

afterEach(() => {
  vi.unstubAllGlobals()

  if (originalDocument) {
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      writable: true,
      value: originalDocument,
    })
  } else {
    Reflect.deleteProperty(globalThis, 'document')
  }

  if (originalWindow) {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      writable: true,
      value: originalWindow,
    })
    return
  }

  Reflect.deleteProperty(globalThis, 'window')
})

describe('WEB_API_PREFIX', () => {
  it('uses the /api/web prefix for web-facing endpoints', () => {
    expect(WEB_API_PREFIX).toBe('/api/web')
  })
})

describe('buildApiUrl', () => {
  it('returns the path as-is when no runtime base URL is configured', () => {
    expect(buildApiUrl('/api/v1/auth/me')).toBe('/api/v1/auth/me')
  })

  it('prepends the runtime base URL when one is set', () => {
    window.__SKILLHUB_RUNTIME_CONFIG__ = { apiBaseUrl: 'https://api.example.com' }
    const url = buildApiUrl('/api/v1/auth/me')
    expect(url).toBe('https://api.example.com/api/v1/auth/me')
  })

  it('handles a trailing slash on the base URL', () => {
    window.__SKILLHUB_RUNTIME_CONFIG__ = { apiBaseUrl: 'https://api.example.com/' }
    const url = buildApiUrl('/api/v1/auth/me')
    expect(url).toBe('https://api.example.com/api/v1/auth/me')
  })

  it('preserves base URL path prefixes', () => {
    window.__SKILLHUB_RUNTIME_CONFIG__ = { apiBaseUrl: 'https://api.example.com/skill_hub' }
    const url = buildApiUrl('/api/v1/auth/me')
    expect(url).toBe('https://api.example.com/skill_hub/api/v1/auth/me')
  })

  it('supports relative base URL path prefixes', () => {
    window.__SKILLHUB_RUNTIME_CONFIG__ = { apiBaseUrl: '/skill_hub' }
    const url = buildApiUrl('/api/v1/auth/me')
    expect(url).toBe('/skill_hub/api/v1/auth/me')
  })
})

describe('getAppBaseUrl', () => {
  it('returns the configured public application URL', () => {
    window.__SKILLHUB_RUNTIME_CONFIG__ = { appBaseUrl: 'https://example.com/skillhub' }

    expect(getAppBaseUrl()).toBe('https://example.com/skillhub')
  })
})

describe('fetchText', () => {
  it('applies base URL path prefixes for fetch requests', async () => {
    window.__SKILLHUB_RUNTIME_CONFIG__ = { apiBaseUrl: 'https://api.example.com/skill_hub' }
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => 'ok',
    })
    vi.stubGlobal('fetch', fetchMock)

    await fetchText('/api/v1/auth/me')

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/skill_hub/api/v1/auth/me',
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    )
  })
})

describe('namespaceApi.delete', () => {
  it('sends a DELETE request to the normalized namespace endpoint', async () => {
    window.__SKILLHUB_RUNTIME_CONFIG__ = { apiBaseUrl: 'https://api.example.com' }
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      writable: true,
      value: {
        cookie: 'XSRF-TOKEN=test-token',
      },
    })

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 0,
        msg: 'ok',
        data: null,
        timestamp: '2026-05-07T00:00:00Z',
        requestId: 'req-test',
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await namespaceApi.delete('@team-delete')

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/api/web/namespaces/team-delete',
      expect.objectContaining({
        method: 'DELETE',
        headers: expect.any(Headers),
      }),
    )
  })
})

describe('getDirectAuthRuntimeConfig', () => {
  it('returns disabled when no runtime config is present', () => {
    const config = getDirectAuthRuntimeConfig()
    expect(config.enabled).toBe(false)
    expect(config.provider).toBeUndefined()
  })

  it('returns enabled with provider when both flag and provider are set', () => {
    window.__SKILLHUB_RUNTIME_CONFIG__ = {
      authDirectEnabled: 'true',
      authDirectProvider: 'ldap',
    }
    const config = getDirectAuthRuntimeConfig()
    expect(config.enabled).toBe(true)
    expect(config.provider).toBe('ldap')
  })

  it('returns disabled when the flag is true but the provider is missing', () => {
    window.__SKILLHUB_RUNTIME_CONFIG__ = {
      authDirectEnabled: 'true',
    }
    const config = getDirectAuthRuntimeConfig()
    expect(config.enabled).toBe(false)
  })

  it('returns disabled when the flag is false', () => {
    window.__SKILLHUB_RUNTIME_CONFIG__ = {
      authDirectEnabled: 'false',
      authDirectProvider: 'ldap',
    }
    const config = getDirectAuthRuntimeConfig()
    expect(config.enabled).toBe(false)
  })

  it('treats various truthy flag values correctly', () => {
    for (const flag of ['1', 'yes', 'on', 'TRUE', ' True ']) {
      window.__SKILLHUB_RUNTIME_CONFIG__ = {
        authDirectEnabled: flag,
        authDirectProvider: 'ldap',
      }
      expect(getDirectAuthRuntimeConfig().enabled).toBe(true)
    }
  })
})

describe('getSessionBootstrapRuntimeConfig', () => {
  it('returns disabled when no runtime config is present', () => {
    const config = getSessionBootstrapRuntimeConfig()
    expect(config.enabled).toBe(false)
    expect(config.auto).toBe(false)
    expect(config.provider).toBeUndefined()
  })

  it('returns fully enabled config when all flags and provider are set', () => {
    window.__SKILLHUB_RUNTIME_CONFIG__ = {
      authSessionBootstrapEnabled: '1',
      authSessionBootstrapProvider: 'sso',
      authSessionBootstrapAuto: 'true',
    }
    const config = getSessionBootstrapRuntimeConfig()
    expect(config.enabled).toBe(true)
    expect(config.provider).toBe('sso')
    expect(config.auto).toBe(true)
  })

  it('returns disabled when the provider is blank', () => {
    window.__SKILLHUB_RUNTIME_CONFIG__ = {
      authSessionBootstrapEnabled: 'true',
      authSessionBootstrapProvider: '  ',
    }
    const config = getSessionBootstrapRuntimeConfig()
    expect(config.enabled).toBe(false)
  })
})

describe('governanceApi exclusion parameters', () => {
  function stubGovernanceFetch() {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 0,
        msg: 'ok',
        data: { items: [], total: 0, page: 0, size: 10 },
        timestamp: '2026-09-24T00:00:00Z',
        requestId: 'req-governance',
      }),
    })
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  it('sends exactly one exclude=PROMOTION parameter on inbox requests', async () => {
    const fetchMock = stubGovernanceFetch()

    await governanceApi.getInbox({ type: 'REVIEW', exclude: 'PROMOTION', page: 0, size: 10 })

    const url = new URL(fetchMock.mock.calls[0]?.[0] as string, 'https://api.example.com')
    expect(url.pathname).toBe('/api/web/governance/inbox')
    expect(url.searchParams.getAll('exclude')).toEqual(['PROMOTION'])
    expect(url.searchParams.get('type')).toBe('REVIEW')
    expect(url.searchParams.get('page')).toBe('0')
    expect(url.searchParams.get('size')).toBe('10')
  })

  it('omits the exclude parameter when no exclusion is requested', async () => {
    const fetchMock = stubGovernanceFetch()

    await governanceApi.getInbox({ page: 1, size: 10 })

    const url = new URL(fetchMock.mock.calls[0]?.[0] as string, 'https://api.example.com')
    expect(url.searchParams.has('exclude')).toBe(false)
    expect(url.searchParams.has('type')).toBe(false)
  })

  it('sends exactly one excludeCategory=PROMOTION parameter on governance notification requests', async () => {
    const fetchMock = stubGovernanceFetch()

    await governanceApi.getNotifications({ excludeCategory: 'PROMOTION', page: 2, size: 10 })

    const url = new URL(fetchMock.mock.calls[0]?.[0] as string, 'https://api.example.com')
    expect(url.pathname).toBe('/api/web/governance/notifications')
    expect(url.searchParams.getAll('excludeCategory')).toEqual(['PROMOTION'])
    expect(url.searchParams.get('page')).toBe('2')
    expect(url.searchParams.get('size')).toBe('10')
  })

  it('omits the excludeCategory parameter when no exclusion is requested', async () => {
    const fetchMock = stubGovernanceFetch()

    await governanceApi.getNotifications({ page: 0, size: 10 })

    const url = new URL(fetchMock.mock.calls[0]?.[0] as string, 'https://api.example.com')
    expect(url.searchParams.has('excludeCategory')).toBe(false)
  })
})

describe('notificationApi Lobster exclusion wiring', () => {
  function stubNotificationFetch(data: unknown) {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 0,
        msg: 'ok',
        data,
        timestamp: '2026-09-24T00:00:00Z',
        requestId: 'req-notification',
      }),
    })
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  it('sends exactly one excludeCategory=PROMOTION parameter on list requests', async () => {
    const fetchMock = stubNotificationFetch({ items: [], total: 0, page: 0, size: 20 })

    await notificationApi.list({ page: 0, size: 5, excludeCategory: 'PROMOTION' })

    const url = new URL(fetchMock.mock.calls[0]?.[0] as string, 'https://api.example.com')
    expect(url.pathname).toBe('/api/web/notifications')
    expect(url.searchParams.getAll('excludeCategory')).toEqual(['PROMOTION'])
    expect(url.searchParams.get('page')).toBe('0')
    expect(url.searchParams.get('size')).toBe('5')
  })

  it('sends exactly one excludeCategory=PROMOTION parameter on unread-count requests', async () => {
    const fetchMock = stubNotificationFetch({ count: 4 })

    await notificationApi.getUnreadCount({ excludeCategory: 'PROMOTION' })

    const url = new URL(fetchMock.mock.calls[0]?.[0] as string, 'https://api.example.com')
    expect(url.pathname).toBe('/api/web/notifications/unread-count')
    expect(url.searchParams.getAll('excludeCategory')).toEqual(['PROMOTION'])
  })

  it('combines the exact category filter with the exclusion without duplicating it', async () => {
    const fetchMock = stubNotificationFetch({ items: [], total: 0, page: 0, size: 20 })

    await notificationApi.list({ page: 1, size: 20, category: 'REVIEW', excludeCategory: 'PROMOTION' })

    const url = new URL(fetchMock.mock.calls[0]?.[0] as string, 'https://api.example.com')
    expect(url.searchParams.getAll('excludeCategory')).toEqual(['PROMOTION'])
    expect(url.searchParams.getAll('category')).toEqual(['REVIEW'])
  })

  it('omits the exclusion parameter when no exclusion is requested', async () => {
    const fetchMock = stubNotificationFetch({ items: [], total: 0, page: 0, size: 20 })

    await notificationApi.list({ page: 0, size: 20 })

    const url = new URL(fetchMock.mock.calls[0]?.[0] as string, 'https://api.example.com')
    expect(url.searchParams.has('excludeCategory')).toBe(false)
  })
})
