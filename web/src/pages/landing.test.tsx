import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const navigateMock = vi.fn()
const buttonRecords: Array<{ label: string; onClick?: () => void }> = []
const useVisibleLabelsMock = vi.fn()
const useLocalPublishedCatalogMock = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: unknown }) => children,
  useNavigate: () => navigateMock,
}))

vi.mock('react-i18next', async () => {
  const actual = await vi.importActual<typeof import('react-i18next')>('react-i18next')
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => key,
    }),
  }
})

vi.mock('lucide-react', () => ({
  PackageOpen: () => null,
  Terminal: () => null,
  Shield: () => null,
  Users: () => null,
  GitBranch: () => null,
  Search: () => null,
  Settings: () => null,
}))

vi.mock('@/shared/components/landing-quick-start', () => ({
  LandingQuickStartSection: () => null,
}))

vi.mock('@/features/skill/skill-card', () => ({
  SkillCard: ({ skill }: { skill: { displayName: string } }) => <div>skill-card:{skill.displayName}</div>,
}))

vi.mock('@/shared/components/skeleton-loader', () => ({
  SkeletonList: () => null,
}))

vi.mock('@/shared/hooks/use-skill-queries', () => ({
  useSearchSkills: () => {
    throw new Error('LandingPage must not use raw Portal Search results')
  },
}))

vi.mock('@/shared/hooks/use-local-published-catalog', () => ({
  useLocalPublishedCatalog: () => useLocalPublishedCatalogMock(),
}))

vi.mock('@/shared/hooks/use-label-queries', () => ({
  useVisibleLabels: () => useVisibleLabelsMock(),
}))

vi.mock('@/shared/hooks/use-in-view', () => ({
  useInView: () => ({ ref: vi.fn(), inView: true }),
}))

vi.mock('@/shared/lib/search-query', () => ({
  normalizeSearchQuery: (q: string) => q.trim(),
}))

vi.mock('@/shared/ui/button', () => ({
  Button: ({ children, onClick }: { children?: ReactNode; onClick?: () => void }) => {
    const label = Array.isArray(children) ? children.join('') : String(children ?? '')
    buttonRecords.push({ label, onClick })
    return <button onClick={onClick}>{children}</button>
  },
}))

import { renderToStaticMarkup } from 'react-dom/server'
import { LandingPage } from './landing'

describe('LandingPage', () => {
  beforeEach(() => {
    navigateMock.mockReset()
    buttonRecords.length = 0
    useVisibleLabelsMock.mockReset()
    useLocalPublishedCatalogMock.mockReset()
    useVisibleLabelsMock.mockReturnValue({
      data: [
        { slug: 'code-generation', type: 'RECOMMENDED', displayName: 'Code Generation' },
        { slug: 'operations', type: 'RECOMMENDED', displayName: 'Operations' },
      ],
    })
    useLocalPublishedCatalogMock.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
    })
  })

  it('exports a named component function', () => {
    expect(typeof LandingPage).toBe('function')
  })

  it('renders the brand name in the hero section', () => {
    const html = renderToStaticMarkup(<LandingPage />)

    expect(html).toContain('技能中心')
    expect(html).toContain('landing.hero.title')
  })

  it('renders visible categories from the label query in server order', () => {
    const html = renderToStaticMarkup(<LandingPage />)

    expect(html).toContain('landing.categories.title')
    expect(buttonRecords.map((button) => button.label).slice(0, 2)).toEqual([
      'Code Generation',
      'Operations',
    ])
    expect(useVisibleLabelsMock).toHaveBeenCalledTimes(1)
  })

  it('navigates from a category to the matching server-side search filter', () => {
    renderToStaticMarkup(<LandingPage />)

    buttonRecords.find((button) => button.label === 'Operations')?.onClick?.()

    expect(navigateMock).toHaveBeenCalledWith({
      to: '/search',
      search: {
        q: '',
        label: 'operations',
        sort: 'newest',
        page: 0,
        starredOnly: false,
      },
    })
  })

  it('derives popular and latest sections from eligible local catalog records only', () => {
    useLocalPublishedCatalogMock.mockReturnValue({
      data: [
        { id: 1, displayName: 'Most Popular', namespace: 'global', slug: 'most-popular', downloadCount: 50, starCount: 0, ratingCount: 0, updatedAt: '2026-01-01T00:00:00Z', canSubmitPromotion: false, publishedVersion: { id: 101, version: '1.0.0', status: 'PUBLISHED' } },
        { id: 2, displayName: 'Newest Published', namespace: 'global', slug: 'newest', downloadCount: 10, starCount: 0, ratingCount: 0, updatedAt: '2026-04-01T00:00:00Z', canSubmitPromotion: false, publishedVersion: { id: 102, version: '1.0.0', status: 'PUBLISHED' } },
        { id: 3, displayName: 'Autonomous Execution', namespace: 'global', slug: 'autonomous-execution', downloadCount: 999, starCount: 0, ratingCount: 0, updatedAt: '2026-12-01T00:00:00Z', canSubmitPromotion: false, publishedVersion: undefined, resolutionMode: 'NONE' },
      ],
      isLoading: false,
      isError: false,
      error: null,
    })

    const html = renderToStaticMarkup(<LandingPage />)

    expect(html).not.toContain('Autonomous Execution')
    expect(html.indexOf('skill-card:Most Popular')).toBeLessThan(html.indexOf('skill-card:Newest Published'))
    expect(html.lastIndexOf('skill-card:Newest Published')).toBeLessThan(html.lastIndexOf('skill-card:Most Popular'))
    expect(useLocalPublishedCatalogMock).toHaveBeenCalledTimes(1)
  })
})
