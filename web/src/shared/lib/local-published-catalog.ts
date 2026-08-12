import type { PagedResponse, SkillSummary } from '@/api/types'

export interface LocalPublishedSearchOptions {
  q?: string
  namespace?: string
  labelMembership?: ReadonlySet<string>
  page: number
  size: number
}

function normalizeMatchValue(value: string | undefined): string {
  return (value ?? '').trim().toLocaleLowerCase()
}

export function createSkillIdentityKey(skill: Pick<SkillSummary, 'namespace' | 'slug'>): string {
  const namespace = normalizeMatchValue(skill.namespace).replace(/^@/, '')
  return `${namespace}/${normalizeMatchValue(skill.slug)}`
}

export function isLocalPublishedSkill(skill: SkillSummary): boolean {
  return skill.publishedVersion?.status === 'PUBLISHED'
}

export function createLocalPublishedCatalog(skills: readonly SkillSummary[]): SkillSummary[] {
  return skills.filter(isLocalPublishedSkill)
}

export function createLocalPublishedSearchPage(
  skills: readonly SkillSummary[],
  options: LocalPublishedSearchOptions,
): PagedResponse<SkillSummary> {
  const query = normalizeMatchValue(options.q)
  const namespace = normalizeMatchValue(options.namespace).replace(/^@/, '')
  const page = Math.max(0, Math.floor(options.page))
  const size = Math.max(1, Math.floor(options.size))

  const filtered = createLocalPublishedCatalog(skills).filter((skill) => {
    if (namespace && normalizeMatchValue(skill.namespace).replace(/^@/, '') !== namespace) {
      return false
    }

    if (options.labelMembership && !options.labelMembership.has(createSkillIdentityKey(skill))) {
      return false
    }

    if (!query) {
      return true
    }

    return [skill.displayName, skill.slug, skill.summary, skill.namespace]
      .some((value) => normalizeMatchValue(value).includes(query))
  })

  const start = page * size
  return {
    items: filtered.slice(start, start + size),
    total: filtered.length,
    page,
    size,
  }
}

export function createLandingCatalogSections(skills: readonly SkillSummary[], count: number) {
  const catalog = createLocalPublishedCatalog(skills)
  const limit = Math.max(0, Math.floor(count))

  return {
    popular: [...catalog]
      .sort((left, right) => right.downloadCount - left.downloadCount)
      .slice(0, limit),
    latest: [...catalog]
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, limit),
  }
}
