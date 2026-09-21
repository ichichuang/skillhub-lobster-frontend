import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/client'
import type { AdminSkillDetailResponse, AdminSkillSummary } from '@/api/types'

export type { AdminSkillDetailResponse, AdminSkillSummary }

/**
 * Admin skill-inventory hooks for GET /api/v1/admin/skills and the existing
 * hide/unhide mutations.
 *
 * Semantics note for maintainers: the UI wording 禁用/启用 requested by
 * leadership maps strictly onto the backend `hidden` governance overlay —
 * 禁用 → adminApi.hideSkill, 启用 → adminApi.unhideSkill. These hooks never
 * touch skill lifecycle status (ACTIVE/ARCHIVED) or version publication state.
 * 删除技能 is a different concept: useHardDeleteSkill maps onto the
 * SUPER_ADMIN hard-delete endpoint (DELETE /api/v1/skills/id/{skillId}),
 * which permanently removes the skill, its versions, files, and related data.
 */
export interface AdminSkillsParams {
  q?: string
  status?: string
  hidden?: boolean
  label?: string
  page?: number
  size?: number
}

export interface PagedAdminSkills {
  items: AdminSkillSummary[]
  total: number
  page: number
  size: number
}

export function useAdminSkills(params: AdminSkillsParams) {
  return useQuery({
    queryKey: ['admin', 'skills', params],
    queryFn: () => adminApi.listSkills(params),
  })
}

/**
 * Lazily fetched administrator detail for the skill detail modal: the request
 * only runs while the modal is open, and results stay cached per skill id.
 */
export function useAdminSkillDetail(skillId: number | null, enabled: boolean) {
  return useQuery({
    queryKey: ['admin', 'skills', 'detail', skillId],
    queryFn: () => adminApi.getSkillDetail(skillId as number),
    enabled: enabled && skillId !== null,
  })
}

/**
 * Packaged file metadata for one version, fetched only while the 文件 tab of
 * the admin detail modal is active so opening the modal never preloads files.
 */
export function useAdminVersionFiles(skillId: number | null, versionId: number | null, enabled: boolean) {
  return useQuery({
    queryKey: ['admin', 'skills', 'files', skillId, versionId],
    queryFn: () => adminApi.listVersionFiles(skillId as number, versionId as number),
    enabled: enabled && skillId !== null && versionId !== null,
  })
}

export function useHideSkill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ skillId }: { skillId: number }) => adminApi.hideSkill(skillId),
    onSuccess: () => {
      // Availability lives in the backend hidden overlay; refetch so the row
      // reflects the persisted state instead of local-only state.
      queryClient.invalidateQueries({ queryKey: ['admin', 'skills'] })
    },
  })
}

export function useUnhideSkill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ skillId }: { skillId: number }) => adminApi.unhideSkill(skillId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'skills'] })
    },
  })
}

export function useHardDeleteSkill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ skillId }: { skillId: number }) => adminApi.deleteSkill(skillId),
    onSuccess: (_data, { skillId }) => {
      // Drop the deleted skill's detail/files caches outright: refetching them
      // could only 404 while the detail modal is closing and reach the global
      // query-error toaster. Refresh list queries (['admin','skills',params])
      // only — never the detail/files keys.
      queryClient.removeQueries({ queryKey: ['admin', 'skills', 'detail', skillId] })
      queryClient.removeQueries({ queryKey: ['admin', 'skills', 'files', skillId] })
      queryClient.invalidateQueries({
        queryKey: ['admin', 'skills'],
        predicate: (query) => query.queryKey.length === 3 && typeof query.queryKey[2] === 'object',
      })
    },
  })
}
