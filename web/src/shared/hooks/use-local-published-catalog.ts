import { useQuery } from '@tanstack/react-query'
import type { PagedResponse, SkillSummary } from '@/api/types'
import { fetchJson } from '@/api/client'
import { createLocalPublishedCatalog, createSkillIdentityKey } from '@/shared/lib/local-published-catalog'
import { fetchAllPagedItems } from '@/shared/lib/full-pagination'
import { buildSkillSearchUrl } from './skill-query-helpers'

const LOCAL_CATALOG_STALE_TIME_MS = 5 * 60 * 1000

async function fetchAllPortalSkillSummaries(label?: string): Promise<SkillSummary[]> {
  return fetchAllPagedItems((page, size) => (
    fetchJson<PagedResponse<SkillSummary>>(buildSkillSearchUrl({
      label,
      sort: 'newest',
      page,
      size,
    }))
  ))
}

export async function fetchLocalPublishedCatalog(): Promise<SkillSummary[]> {
  const portalSkills = await fetchAllPortalSkillSummaries()
  return createLocalPublishedCatalog(portalSkills)
}

export async function fetchLocalPublishedLabelMembership(label: string): Promise<ReadonlySet<string>> {
  const labelSkills = await fetchAllPortalSkillSummaries(label)
  return new Set(labelSkills.map(createSkillIdentityKey))
}

export function useLocalPublishedCatalog() {
  return useQuery({
    queryKey: ['skills', 'local-published-catalog'],
    queryFn: fetchLocalPublishedCatalog,
    staleTime: LOCAL_CATALOG_STALE_TIME_MS,
  })
}

export function useLocalPublishedLabelMembership(label?: string, viewerId?: string) {
  return useQuery({
    queryKey: viewerId
      ? ['skills', 'local-published-catalog', 'label-membership', 'viewer', viewerId, label]
      : ['skills', 'local-published-catalog', 'label-membership', label],
    queryFn: () => fetchLocalPublishedLabelMembership(label!),
    enabled: Boolean(label),
    staleTime: LOCAL_CATALOG_STALE_TIME_MS,
  })
}
