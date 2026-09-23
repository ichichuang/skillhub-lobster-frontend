/**
 * Bootstraps runtime configuration before the React bundle mounts.
 *
 * Deployments inject `/runtime-config.js` at startup, and this file guarantees the app sees either
 * that config or a safe fallback object before importing the main entry.
 */
import './legacy-polyfills'
import { initializeTheme } from './shared/lib/theme'
import {
  parseUrlAutoLoginCredentials,
  performUrlAutoLogin,
} from './shared/lib/url-auto-login'

initializeTheme()

async function loadRuntimeConfig() {
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = new URL('../runtime-config.js', import.meta.url).toString()
    script.async = false
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load runtime config'))
    document.head.appendChild(script)
  })
}

function ensureRuntimeConfigFallback() {
  if (!window.__SKILLHUB_RUNTIME_CONFIG__) {
    window.__SKILLHUB_RUNTIME_CONFIG__ = {
      apiBaseUrl: '',
      appBaseUrl: '',
      authDirectEnabled: 'false',
      authDirectProvider: '',
      authSessionBootstrapEnabled: 'false',
      authSessionBootstrapProvider: '',
      authSessionBootstrapAuto: 'false',
    }
  }
}

/**
 * TEMPORARY compatibility behavior (v0.2.21 migration): an initial URL with
 * one username/password pair performs a single session-first auto-login.
 * Runs at most once per bootstrap, never retries, never logs over an existing
 * session, and keeps credentials out of storage/logs/router state.
 */
async function tryUrlAutoLogin() {
  if (!parseUrlAutoLoginCredentials(window.location.search)) {
    return
  }

  try {
    const {
      authApi,
      getCurrentUser,
      getDirectAuthRuntimeConfig,
    } = await import('./api/client')

    await performUrlAutoLogin(window.location.search, {
      getCurrentUser,
      getDirectAuthRuntimeConfig,
      localLogin: (credentials) => authApi.localLogin(credentials),
      directLogin: (provider, credentials) => authApi.directLogin(provider, credentials),
    })
  } catch (error) {
    // Deliberately non-secret: the API error carries the server message, never
    // the credentials. Startup continues into the normal login-capable app.
    console.error('URL auto-login failed:', error instanceof Error ? error.message : error)
  }
}

void (async () => {
  try {
    await loadRuntimeConfig()
  } catch (error) {
    console.error(error)
    ensureRuntimeConfigFallback()
  }

  await tryUrlAutoLogin()
  await import('./main')
})()
