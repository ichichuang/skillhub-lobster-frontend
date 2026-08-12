/**
 * Bootstraps runtime configuration before the React bundle mounts.
 *
 * Deployments inject `/runtime-config.js` at startup, and this file guarantees the app sees either
 * that config or a safe fallback object before importing the main entry.
 */
import './legacy-polyfills'
import {
  applyThemeMode,
  parseParentUrlTheme,
  resolveParentThemeMode,
} from './shared/lib/url-theme'
import {
  parseUrlAutoLoginCredentials,
  performUrlAutoLogin,
} from './shared/lib/url-auto-login'

const parentTheme = parseParentUrlTheme(window.location.search)
applyThemeMode(resolveParentThemeMode(parentTheme))

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
    console.error(error)
  }
}

void (async () => {
  try {
    await loadRuntimeConfig()
  } catch (error) {
    console.error(error)
  }

  ensureRuntimeConfigFallback()
  await tryUrlAutoLogin()
  await import('./main')
})()
