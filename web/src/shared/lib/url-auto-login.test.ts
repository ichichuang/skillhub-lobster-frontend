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
  it('returns one complete credential pair while trimming only the username', () => {
    expect(parseUrlAutoLoginCredentials('?username=%20admin%20&password=%20secret%20')).toEqual({
      username: 'admin',
      password: ' secret ',
    })
  })

  it.each([
    ['missing username', '?password=secret'],
    ['missing password', '?username=admin'],
    ['empty username', '?username=%20%20&password=secret'],
    ['empty password', '?username=admin&password='],
    ['duplicate username', '?username=admin&username=other&password=secret'],
    ['duplicate password', '?username=admin&password=secret&password=other'],
  ])('rejects %s', (_caseName, search) => {
    expect(parseUrlAutoLoginCredentials(search)).toBeNull()
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

  it('calls local login exactly once with the parsed credentials when the session is absent', async () => {
    const dependencies = createDependencies()

    await performUrlAutoLogin('?username=%20admin%20&password=%20secret%20', dependencies)

    expect(dependencies.getCurrentUser).toHaveBeenCalledOnce()
    expect(dependencies.localLogin).toHaveBeenCalledOnce()
    expect(dependencies.localLogin).toHaveBeenCalledWith({
      username: 'admin',
      password: ' secret ',
    })
    expect(dependencies.directLogin).not.toHaveBeenCalled()
  })

  it('uses the configured direct-auth provider instead of local login', async () => {
    const dependencies = createDependencies({
      getDirectAuthRuntimeConfig: vi.fn().mockReturnValue({
        enabled: true,
        provider: 'enterprise',
      }),
    })

    await performUrlAutoLogin('?username=admin&password=secret', dependencies)

    expect(dependencies.directLogin).toHaveBeenCalledOnce()
    expect(dependencies.directLogin).toHaveBeenCalledWith('enterprise', {
      username: 'admin',
      password: 'secret',
    })
    expect(dependencies.localLogin).not.toHaveBeenCalled()
  })

  it('falls back to local login when direct auth has no provider', async () => {
    const dependencies = createDependencies({
      getDirectAuthRuntimeConfig: vi.fn().mockReturnValue({ enabled: true }),
    })

    await performUrlAutoLogin('?username=admin&password=secret', dependencies)

    expect(dependencies.localLogin).toHaveBeenCalledOnce()
    expect(dependencies.directLogin).not.toHaveBeenCalled()
  })

  it.each([
    ['missing username', '?password=secret'],
    ['missing password', '?username=admin'],
    ['empty username', '?username=%20&password=secret'],
    ['empty password', '?username=admin&password='],
    ['duplicate username', '?username=admin&username=other&password=secret'],
    ['duplicate password', '?username=admin&password=secret&password=other'],
  ])('does not check the session or log in for %s', async (_caseName, search) => {
    const dependencies = createDependencies()

    await performUrlAutoLogin(search, dependencies)

    expect(dependencies.getCurrentUser).not.toHaveBeenCalled()
    expect(dependencies.localLogin).not.toHaveBeenCalled()
    expect(dependencies.directLogin).not.toHaveBeenCalled()
  })
})
