export const LANDING_MAIN_CLASS_NAME = 'flex-1 relative z-10'
export const DEFAULT_MAIN_CLASS_NAME = 'flex-1 relative z-10 px-6 py-10 md:px-12'
export const CENTERED_MAIN_CLASS_NAME = 'flex-1 relative z-10 px-4 py-8 sm:px-6 md:px-8 md:py-10 lg:px-10 xl:px-14 2xl:px-20'
export const CENTERED_SEARCH_CONTENT_CLASS_NAME = 'mx-auto w-full max-w-[1200px]'
export const CENTERED_DASHBOARD_CONTENT_CLASS_NAME = 'mx-auto w-full max-w-[1200px]'
export const FIXED_VIEWPORT_MAIN_CLASS_NAME = 'flex-1 relative z-10 min-h-0 overflow-hidden px-6 py-6 md:px-12 md:py-8'
export const FIXED_VIEWPORT_CONTENT_CLASS_NAME = 'mx-auto flex h-full min-h-0 w-full max-w-[1200px] flex-col'

interface AppMainContentLayout {
  mainClassName: string
  contentClassName: string
  /** The route owns the full viewport: the app shell is height-locked and the page scrolls internally. */
  fixedViewport?: boolean
}

export function resolveAppMainContentPathname(
  pathname: string,
  resolvedPathname?: string,
): string {
  return resolvedPathname ?? pathname
}

export function getAppMainContentLayout(pathname: string): AppMainContentLayout {
  if (pathname === '/') {
    return {
      mainClassName: LANDING_MAIN_CLASS_NAME,
      contentClassName: '',
    }
  }

  if (pathname === '/search') {
    return {
      mainClassName: CENTERED_MAIN_CLASS_NAME,
      contentClassName: CENTERED_SEARCH_CONTENT_CLASS_NAME,
    }
  }

  if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) {
    return {
      mainClassName: CENTERED_MAIN_CLASS_NAME,
      contentClassName: CENTERED_DASHBOARD_CONTENT_CLASS_NAME,
    }
  }

  if (pathname === '/admin/skills') {
    return {
      mainClassName: FIXED_VIEWPORT_MAIN_CLASS_NAME,
      contentClassName: FIXED_VIEWPORT_CONTENT_CLASS_NAME,
      fixedViewport: true,
    }
  }

  return {
    mainClassName: DEFAULT_MAIN_CLASS_NAME,
    contentClassName: '',
  }
}
