import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import type { SkillSummary, PagedResponse } from '@/api/types'
import { meApi, promotionApi, namespaceApi } from '@/api/client'
import { fetchAllPagedItems } from '@/shared/lib/full-pagination'

export interface MySkillsParams {
  page?: number
  size?: number
  filter?: string
  q?: string
  namespace?: string
}

export interface CompleteMyPublishedSkillsParams {
  q?: string
  namespace?: string
}

const COMPLETE_MY_SKILLS_STALE_TIME_MS = 5 * 60 * 1000

async function getMySkills(params: MySkillsParams = {}): Promise<PagedResponse<SkillSummary>> {
  return meApi.getSkills(params)
}

export async function fetchAllMyPublishedSkills(
  params: CompleteMyPublishedSkillsParams = {},
): Promise<SkillSummary[]> {
  return fetchAllPagedItems((page, size) => getMySkills({
    page,
    size,
    filter: 'PUBLISHED',
    q: params.q,
    namespace: params.namespace,
  }))
}

async function getMyStars(): Promise<SkillSummary[]> {
  return meApi.getStars()
}

async function getMyStarsPage(params: { page?: number; size?: number } = {}): Promise<PagedResponse<SkillSummary>> {
  return meApi.getStarsPage(params)
}

async function getMySubscriptions(): Promise<SkillSummary[]> {
  return meApi.getSubscriptions()
}

async function getMySubscriptionsPage(params: { page?: number; size?: number } = {}): Promise<PagedResponse<SkillSummary>> {
  return meApi.getSubscriptionsPage(params)
}

async function submitPromotion(params: { sourceSkillId: number; sourceVersionId: number }): Promise<void> {
  const globalNamespace = await namespaceApi.getDetail('global')
  await promotionApi.submit({
    sourceSkillId: params.sourceSkillId,
    sourceVersionId: params.sourceVersionId,
    targetNamespaceId: globalNamespace.id,
  })
}

export function useMySkills(params: MySkillsParams = {}, enabled = true) {
  return useQuery({
    queryKey: ['skills', 'my', params],
    queryFn: () => getMySkills(params),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useAllMyPublishedSkills(params: CompleteMyPublishedSkillsParams = {}, enabled = true) {
  return useQuery({
    queryKey: ['skills', 'my', 'published-complete', params],
    queryFn: () => fetchAllMyPublishedSkills(params),
    enabled,
    staleTime: COMPLETE_MY_SKILLS_STALE_TIME_MS,
  })
}

export function useMyStars(enabled = true) {
  return useQuery({
    queryKey: ['skills', 'stars'],
    queryFn: getMyStars,
    enabled,
  })
}

export function useMyStarsPage(params: { page?: number; size?: number } = {}, enabled = true) {
  return useQuery({
    queryKey: ['skills', 'stars', 'page', params],
    queryFn: () => getMyStarsPage(params),
    enabled,
  })
}

export function useMySubscriptions(enabled = true) {
  return useQuery({
    queryKey: ['skills', 'subscriptions'],
    queryFn: getMySubscriptions,
    enabled,
  })
}

export function useMySubscriptionsPage(params: { page?: number; size?: number } = {}, enabled = true) {
  return useQuery({
    queryKey: ['skills', 'subscriptions', 'page', params],
    queryFn: () => getMySubscriptionsPage(params),
    enabled,
  })
}

export function useSubmitPromotion() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: submitPromotion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] })
      queryClient.invalidateQueries({ queryKey: ['governance'] })
      queryClient.invalidateQueries({ queryKey: ['skills'] })
    },
  })
}
