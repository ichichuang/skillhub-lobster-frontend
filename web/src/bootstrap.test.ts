/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const bootstrapMocks = vi.hoisted(() => ({
  apiModuleLoaded: vi.fn(),
  mainModuleLoaded: vi.fn(),
  getCurrentUser: vi.fn(),
  getDirectAuthRuntimeConfig: vi.fn(),
  localLogin: vi.fn(),
  directLogin: vi.fn(),
}))

vi.mock('./legacy-polyfills', () => ({}))

interface Deferred<T> {
  readonly promise: Promise<T>
  readonly resolve: (value: T) => void
  readonly reject: (reason: unknown) => void
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

async function startBootstrap(search: string): Promise<HTMLScriptElement> {
  window.history.replaceState(null, '', `/${search}`)
  const root = document.documentElement
  root.className = 'notranslate'
  root.removeAttribute('style')
  vi.resetModules()
  vi.doMock('./api/client', () => {
    bootstrapMocks.apiModuleLoaded()
    return {
      getCurrentUser: bootstrapMocks.getCurrentUser,
      getDirectAuthRuntimeConfig: bootstrapMocks.getDirectAuthRuntimeConfig,
      authApi: {
        localLogin: bootstrapMocks.localLogin,
        directLogin: bootstrapMocks.directLogin,
      },
    }
  })
  vi.doMock('./main', () => {
    bootstrapMocks.mainModuleLoaded()
    return {}
  })

  await import('./bootstrap')

  const runtimeConfigScript = document.head.querySelector<HTMLScriptElement>('script[src*="runtime-config.js"]')
  if (!runtimeConfigScript) {
    throw new Error('Bootstrap did not append the runtime-config script')
  }
  return runtimeConfigScript
}

async function finishRuntimeConfigLoad(script: HTMLScriptElement): Promise<void> {
  window.__SKILLHUB_RUNTIME_CONFIG__ = {
    apiBaseUrl: '',
    appBaseUrl: '',
    authDirectEnabled: 'false',
    authDirectProvider: '',
    authSessionBootstrapEnabled: 'false',
    authSessionBootstrapProvider: '',
    authSessionBootstrapAuto: 'false',
  }
  script.dispatchEvent(new Event('load'))
  await vi.waitFor(() => expect(bootstrapMocks.mainModuleLoaded).toHaveBeenCalledOnce())
}

async function runBootstrap(search: string) {
  const runtimeConfigScript = await startBootstrap(search)
  await finishRuntimeConfigLoad(runtimeConfigScript)
  const root = document.documentElement

  return {
    isDark: root.classList.contains('dark'),
    colorScheme: root.style.colorScheme,
    background: root.style.getPropertyValue('--background'),
    primary: root.style.getPropertyValue('--primary'),
    pageAnchor: root.style.getPropertyValue('--theme-page-anchor'),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  bootstrapMocks.getCurrentUser.mockResolvedValue(null)
  bootstrapMocks.getDirectAuthRuntimeConfig.mockReturnValue({ enabled: false })
  bootstrapMocks.localLogin.mockResolvedValue({ userId: 'local-user' })
  bootstrapMocks.directLogin.mockResolvedValue({ userId: 'direct-user' })
})

afterEach(() => {
  document.head.querySelectorAll('script[src*="runtime-config.js"]').forEach((script) => script.remove())
  delete window.__SKILLHUB_RUNTIME_CONFIG__
})

describe('bootstrap fixed theme mode', () => {
  it.each([
    ['dark=0', '?dark=0', true, 'dark'],
    ['dark=1', '?dark=1', false, 'light'],
    ['retired dark theme', '?theme=dark&bg=%23000000', false, 'light'],
  ] as const)('applies %s without writing palette variables', async (
    _caseName,
    search,
    isDark,
    colorScheme,
  ) => {
    await expect(runBootstrap(search)).resolves.toEqual({
      isDark,
      colorScheme,
      background: '',
      primary: '',
      pageAnchor: '',
    })
  })
})

describe('bootstrap URL auto-login', () => {
  it('loads runtime config before the API client and waits for local login before importing main', async () => {
    const login = createDeferred<unknown>()
    bootstrapMocks.localLogin.mockReturnValue(login.promise)

    const runtimeConfigScript = await startBootstrap('?username=%20admin%20&password=%20secret%20')

    expect(bootstrapMocks.apiModuleLoaded).not.toHaveBeenCalled()
    expect(bootstrapMocks.getCurrentUser).not.toHaveBeenCalled()
    expect(bootstrapMocks.mainModuleLoaded).not.toHaveBeenCalled()

    runtimeConfigScript.dispatchEvent(new Event('load'))
    await vi.waitFor(() => expect(bootstrapMocks.localLogin).toHaveBeenCalledOnce())

    expect(bootstrapMocks.apiModuleLoaded).toHaveBeenCalledOnce()
    expect(bootstrapMocks.getCurrentUser).toHaveBeenCalledOnce()
    expect(bootstrapMocks.localLogin).toHaveBeenCalledWith({
      username: 'admin',
      password: ' secret ',
    })
    expect(bootstrapMocks.mainModuleLoaded).not.toHaveBeenCalled()

    login.resolve({ userId: 'local-user' })
    await vi.waitFor(() => expect(bootstrapMocks.mainModuleLoaded).toHaveBeenCalledOnce())

    expect(bootstrapMocks.localLogin).toHaveBeenCalledOnce()
    expect(bootstrapMocks.directLogin).not.toHaveBeenCalled()
  })

  it('skips both login endpoints when the session already has a user', async () => {
    bootstrapMocks.getCurrentUser.mockResolvedValue({ userId: 'existing-user' })
    const runtimeConfigScript = await startBootstrap('?username=admin&password=secret')

    await finishRuntimeConfigLoad(runtimeConfigScript)

    expect(bootstrapMocks.getCurrentUser).toHaveBeenCalledOnce()
    expect(bootstrapMocks.localLogin).not.toHaveBeenCalled()
    expect(bootstrapMocks.directLogin).not.toHaveBeenCalled()
  })

  it('does not import the API client or add a session check for incomplete credentials', async () => {
    const runtimeConfigScript = await startBootstrap('?username=admin')

    await finishRuntimeConfigLoad(runtimeConfigScript)

    expect(bootstrapMocks.apiModuleLoaded).not.toHaveBeenCalled()
    expect(bootstrapMocks.getCurrentUser).not.toHaveBeenCalled()
    expect(bootstrapMocks.localLogin).not.toHaveBeenCalled()
    expect(bootstrapMocks.directLogin).not.toHaveBeenCalled()
  })

  it.each([
    ['session check', () => bootstrapMocks.getCurrentUser.mockRejectedValue(new Error('session failed'))],
    ['password login', () => bootstrapMocks.localLogin.mockRejectedValue(new Error('login failed'))],
  ])('imports main once when the automatic %s fails without retrying', async (_caseName, arrangeFailure) => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    arrangeFailure()
    const runtimeConfigScript = await startBootstrap('?username=admin&password=secret')

    await finishRuntimeConfigLoad(runtimeConfigScript)

    expect(bootstrapMocks.getCurrentUser).toHaveBeenCalledOnce()
    expect(bootstrapMocks.localLogin).toHaveBeenCalledTimes(_caseName === 'password login' ? 1 : 0)
    expect(bootstrapMocks.directLogin).not.toHaveBeenCalled()
    expect(bootstrapMocks.mainModuleLoaded).toHaveBeenCalledOnce()
    expect(consoleError).toHaveBeenCalledOnce()
    consoleError.mockRestore()
  })
})
