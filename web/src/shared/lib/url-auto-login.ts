import type { User } from '@/api/types'

/**
 * TEMPORARY compatibility layer (v0.2.21 migration): an initial URL may carry
 * one username/password pair for an automatic first login, so legacy host
 * links keep working while a safer host-to-session exchange is designed.
 *
 * Security posture (deliberate, do not widen):
 * - credentials are parsed strictly from the bootstrap-time URL only;
 * - they are never persisted to storage, router state, or retained query keys;
 * - the attempt runs at most once per page bootstrap, session-first — an
 *   already-authenticated session is never logged over;
 * - a failed attempt never retries automatically.
 */
export interface UrlAutoLoginCredentials {
  readonly username: string
  readonly password: string
}

interface DirectAuthRuntimeConfig {
  readonly enabled: boolean
  readonly provider?: string
}

export interface UrlAutoLoginDependencies {
  readonly getCurrentUser: () => Promise<unknown | null>
  readonly getDirectAuthRuntimeConfig: () => DirectAuthRuntimeConfig
  readonly localLogin: (credentials: UrlAutoLoginCredentials) => Promise<User>
  readonly directLogin: (provider: string, credentials: UrlAutoLoginCredentials) => Promise<User>
}

/**
 * Strict credential parsing at the bootstrap boundary: exactly one username
 * and one password must be present; the username is trimmed, the password is
 * intentionally not (it may legitimately contain leading/trailing spaces).
 * Duplicates, blanks, and malformed representations never activate auto-login.
 */
export function parseUrlAutoLoginCredentials(search: string): UrlAutoLoginCredentials | null {
  const searchParams = new URLSearchParams(search)
  const usernames = searchParams.getAll('username')
  const passwords = searchParams.getAll('password')

  if (usernames.length !== 1 || passwords.length !== 1) {
    return null
  }

  const username = usernames[0].trim()
  const password = passwords[0]
  if (!username || !password) {
    return null
  }

  return { username, password }
}

/**
 * Session-first auto-login: check the current session, then — only when
 * unauthenticated and valid URL credentials exist — perform exactly one login
 * through the runtime-config-selected endpoint (direct provider or local).
 * The official auth API handles CSRF headers/cookies.
 */
export async function performUrlAutoLogin(
  search: string,
  dependencies: UrlAutoLoginDependencies,
): Promise<User | null> {
  const credentials = parseUrlAutoLoginCredentials(search)
  if (!credentials) {
    return null
  }

  const currentUser = await dependencies.getCurrentUser()
  if (currentUser) {
    return null
  }

  const directAuthConfig = dependencies.getDirectAuthRuntimeConfig()
  if (directAuthConfig.enabled && directAuthConfig.provider) {
    return dependencies.directLogin(directAuthConfig.provider, credentials)
  }

  return dependencies.localLogin(credentials)
}
