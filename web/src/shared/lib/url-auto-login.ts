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
  readonly localLogin: (credentials: UrlAutoLoginCredentials) => Promise<unknown>
  readonly directLogin: (provider: string, credentials: UrlAutoLoginCredentials) => Promise<unknown>
}

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

export async function performUrlAutoLogin(
  search: string,
  dependencies: UrlAutoLoginDependencies,
): Promise<void> {
  const credentials = parseUrlAutoLoginCredentials(search)
  if (!credentials) {
    return
  }

  const currentUser = await dependencies.getCurrentUser()
  if (currentUser) {
    return
  }

  const directAuthConfig = dependencies.getDirectAuthRuntimeConfig()
  if (directAuthConfig.enabled && directAuthConfig.provider) {
    await dependencies.directLogin(directAuthConfig.provider, credentials)
    return
  }

  await dependencies.localLogin(credentials)
}
