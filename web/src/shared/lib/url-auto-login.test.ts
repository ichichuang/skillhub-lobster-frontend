import { describe, expect, it, vi } from 'vitest'
import {
  parseUrlAutoLoginCredentials,
  performUrlAutoLogin,
  type UrlAutoLoginDependencies,
} from './url-auto-login'

function createDependencies(overrides: Partial<UrlAutoLoginDependencies> = {}): UrlAutoLoginDependencies {
  return {
    getCurrentUser: vi.fn().mockResolvedValue(null),
    getDirectAuthRuntimeConfig: vi.fn().mockReturnValue({ enabled: false }),
    localLogin: vi.fn().mockResolvedValue({ userId: 'local-user' }),
    directLogin: vi.fn().mockResolvedValue({ userId: 'direct-user' }),
    ...overrides,
  }
}

describe('parseUrlAutoLoginCredentials', () => {
  it('returns no credentials when neither parameter is present', () => {
    expect(parseUrlAutoLoginCredentials('')).toBeNull()
    expect(parseUrlAutoLoginCredentials('?embed=true&dark=0')).toBeNull()
  })

  it('returns no credentials for username only', () => {
    expect(parseUrlAutoLoginCredentials('?username=admin')).toBeNull()
  })

  it('returns no credentials for password only', () => {
    expect(parseUrlAutoLoginCredentials('?password=secret')).toBeNull()
  })

  it('returns one complete credential pair while trimming only the username', () => {
    expect(parseUrlAutoLoginCredentials('?username=%20admin%20&password=%20secret%20')).toEqual({
      username: 'admin',
      password: ' secret ',
    })
  })

  it('rejects duplicate username values', () => {
    expect(parseUrlAutoLoginCredentials('?username=admin&username=other&password=secret')).toBeNull()
  })

  it('rejects duplicate password values', () => {
    expect(parseUrlAutoLoginCredentials('?username=admin&password=secret&password=other')).toBeNull()
  })

  it('rejects blank username and blank password after trimming', () => {
    expect(parseUrlAutoLoginCredentials('?username=%20%20&password=secret')).toBeNull()
    expect(parseUrlAutoLoginCredentials('?username=admin&password=')).toBeNull()
  })

  it('rejects malformed array-like representations', () => {
    // Duplicate query keys (which the router JSON-parses into arrays) never
    // activate auto-login — covered by the duplicate tests above at the real
    // URLSearchParams boundary, which cannot produce array values.
    expect(parseUrlAutoLoginCredentials('?username=admin&username=admin&password=secret')).toBeNull()
    expect(parseUrlAutoLoginCredentials('?username=admin&password=secret&password=secret')).toBeNull()
  })
})

describe('performUrlAutoLogin', () => {
  it('checks the session and skips both login endpoints for an authenticated user', async () => {
    const dependencies = createDependencies({
      getCurrentUser: vi.fn().mockResolvedValue({ userId: 'existing-user' }),
    })

    await performUrlAutoLogin('?username=admin&password=secret', dependencies)

    expect(dependencies.getCurrentUser).toHaveBeenCalledOnce()
    expect(dependencies.localLogin).not.toHaveBeenCalled()
    expect(dependencies.directLogin).not.toHaveBeenCalled()
  })

  it('performs exactly one local login for an unauthenticated user in local mode', async () => {
    const dependencies = createDependencies()

    await performUrlAutoLogin('?username=admin&password=secret', dependencies)

    expect(dependencies.getCurrentUser).toHaveBeenCalledOnce()
    expect(dependencies.localLogin).toHaveBeenCalledOnce()
    expect(dependencies.localLogin).toHaveBeenCalledWith({ username: 'admin', password: 'secret' })
    expect(dependencies.directLogin).not.toHaveBeenCalled()
  })

  it('performs exactly one direct login when the runtime config enables direct auth', async () => {
    const dependencies = createDependencies({
      getDirectAuthRuntimeConfig: vi.fn().mockReturnValue({ enabled: true, provider: 'lobster-host' }),
    })

    await performUrlAutoLogin('?username=admin&password=secret', dependencies)

    expect(dependencies.directLogin).toHaveBeenCalledOnce()
    expect(dependencies.directLogin).toHaveBeenCalledWith('lobster-host', { username: 'admin', password: 'secret' })
    expect(dependencies.localLogin).not.toHaveBeenCalled()
  })

  it('performs no login for invalid or partial credentials', async () => {
    for (const search of ['?username=admin', '?password=secret', '?username=admin&username=admin&password=secret', '?embed=true']) {
      const dependencies = createDependencies()
      await performUrlAutoLogin(search, dependencies)
      expect(dependencies.getCurrentUser, search).not.toHaveBeenCalled()
      expect(dependencies.localLogin, search).not.toHaveBeenCalled()
      expect(dependencies.directLogin, search).not.toHaveBeenCalled()
    }
  })

  it('propagates login failure to the caller without retrying', async () => {
    const dependencies = createDependencies({
      localLogin: vi.fn().mockRejectedValue(new Error('invalid credentials')),
    })

    await expect(performUrlAutoLogin('?username=admin&password=secret', dependencies)).rejects.toThrow(
      'invalid credentials',
    )
    expect(dependencies.localLogin).toHaveBeenCalledOnce()
  })
})
