import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pagination } from '@/shared/components/pagination'
import { ConfirmDialog } from '@/shared/components/confirm-dialog'
import { Card } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Button } from '@/shared/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  normalizeSelectValue,
} from '@/shared/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/table'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { VersionStatusBadge } from '@/features/skill/version-status-badge'
import {
  useAdminSkills,
  useAdminSkillDetail,
  useAdminVersionFiles,
  useHideSkill,
  useUnhideSkill,
  useHardDeleteSkill,
} from '@/features/admin/use-admin-skills'
import { useAdminLabelDefinitions } from '@/features/admin/use-admin-labels'
import { formatLocalDateTime } from '@/shared/lib/date-time'
import { toast } from '@/shared/lib/toast'
import type { AdminSkillSummary, LabelItem } from '@/api/types'

const PAGE_SIZE = 20
const ALL_STATES_VALUE = '__all_states__'
const ALL_CATEGORIES_VALUE = '__all_categories__'

export type AdminSkillProductState = 'enabled' | 'disabled' | 'archived'

/**
 * Product-facing 状态 shown to admins. ARCHIVED wins over the hidden overlay:
 * an archived skill is read-only regardless of hidden state.
 */
export function resolveProductState(skill: Pick<AdminSkillSummary, 'status' | 'hidden'>): AdminSkillProductState {
  if (skill.status === 'ARCHIVED') return 'archived'
  if (skill.hidden) return 'disabled'
  return 'enabled'
}

/**
 * Maps the 状态 filter onto the backend contract of GET /api/v1/admin/skills
 * so pagination stays server-correct (no post-pagination client filtering):
 * 已启用 → status=ACTIVE&hidden=false; 已禁用 → status=ACTIVE&hidden=true;
 * 已归档 → status=ARCHIVED; 全部 → both params omitted.
 */
export function resolveProductStateParams(stateFilter: string): { status?: string; hidden?: boolean } {
  if (stateFilter === 'enabled') return { status: 'ACTIVE', hidden: false }
  if (stateFilter === 'disabled') return { status: 'ACTIVE', hidden: true }
  if (stateFilter === 'archived') return { status: 'ARCHIVED' }
  return {}
}

const PRODUCT_STATE_BADGE_CLASSES: Record<AdminSkillProductState, string> = {
  enabled: 'rounded-full border border-success/30 bg-success-surface px-2.5 py-1 text-xs font-medium text-success',
  disabled: 'rounded-full border border-danger/30 bg-danger-surface px-2.5 py-1 text-xs font-medium text-danger',
  archived: 'rounded-full border border-border bg-surface-muted px-2.5 py-1 text-xs font-medium text-muted-foreground',
}

const PRODUCT_STATE_LABEL_KEYS: Record<AdminSkillProductState, string> = {
  enabled: 'adminSkills.stateEnabled',
  disabled: 'adminSkills.stateDisabled',
  archived: 'adminSkills.stateArchived',
}

function resolveLabelDisplayName(
  translations: Array<{ locale: string; displayName: string }>,
  language: string,
  slug: string,
): string {
  const normalized = language.toLowerCase()
  return (
    translations.find((translation) => translation.locale.toLowerCase() === normalized)?.displayName
    ?? translations.find((translation) => translation.locale.toLowerCase().split('-')[0] === normalized.split('-')[0])
      ?.displayName
    ?? translations[0]?.displayName
    ?? slug
  )
}

function resolveVisibilityText(visibility: string | undefined, t: (key: string) => string): string {
  if (!visibility) return '-'
  if (visibility === 'PUBLIC') return t('publish.visibilityOptions.public')
  if (visibility === 'NAMESPACE_ONLY') return t('publish.visibilityOptions.namespaceOnly')
  if (visibility === 'PRIVATE') return t('publish.visibilityOptions.private')
  return visibility
}

function joinLabelDisplayNames(labels: LabelItem[]): string {
  return labels.map((label) => label.displayName).join(' · ')
}

function formatByteSize(size: number | undefined): string {
  if (size === undefined || size === null) {
    return '-'
  }
  if (size < 1024) {
    return `${size} B`
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Task-oriented SUPER_ADMIN skill inventory for the Lobster Factory embed.
 *
 * Wording contract: the single 状态 column and 状态 filter speak product
 * language (已启用/已禁用/已归档) and map strictly onto the backend
 * status + hidden parameters via resolveProductStateParams; 禁用/启用 row and
 * modal actions map onto adminApi.hideSkill / adminApi.unhideSkill only.
 * 删除技能 is a different, permanent concept: it maps onto the SUPER_ADMIN
 * hard-delete endpoint (DELETE /api/v1/skills/id/{skillId}) behind a
 * dedicated confirmation dialog, for ACTIVE/hidden/ARCHIVED skills alike.
 * Archived skills keep read-only enable/disable semantics. Row identity opens
 * the centered admin detail modal, which lazily loads
 * GET /api/v1/admin/skills/{skillId} so the administrator can read the skill
 * summary even for hidden/archived skills.
 */
export function AdminSkillsPage() {
  const { t, i18n } = useTranslation()
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [stateFilter, setStateFilter] = useState('')
  const [labelFilter, setLabelFilter] = useState('')
  const [page, setPage] = useState(0)
  const [selectedSkillId, setSelectedSkillId] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [selectedFilesVersionId, setSelectedFilesVersionId] = useState<number | null>(null)
  const [availabilityTarget, setAvailabilityTarget] = useState<{
    skillId: number
    skillName: string
    nextHidden: boolean
  } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{
    skillId: number
    skillName: string
    coordinate: string
  } | null>(null)
  const [deleteInFlight, setDeleteInFlight] = useState(false)

  const { data, isLoading, isError } = useAdminSkills({
    q: search || undefined,
    ...resolveProductStateParams(stateFilter),
    label: labelFilter || undefined,
    page,
    size: PAGE_SIZE,
  })
  const { data: labelDefinitions } = useAdminLabelDefinitions()

  const hideMutation = useHideSkill()
  const unhideMutation = useUnhideSkill()
  const hardDeleteMutation = useHardDeleteSkill()

  useEffect(() => {
    setPage(0)
  }, [search, stateFilter, labelFilter])

  const applySearch = () => {
    setSearch(searchInput.trim())
  }

  const hasActiveFilters = search !== '' || stateFilter !== '' || labelFilter !== ''

  const resetFilters = () => {
    setSearchInput('')
    setSearch('')
    setStateFilter('')
    setLabelFilter('')
  }

  const openAvailabilityConfirm = (skillId: number, skillName: string, hidden: boolean) => {
    setAvailabilityTarget({ skillId, skillName, nextHidden: !hidden })
  }

  const confirmAvailabilityChange = async () => {
    if (!availabilityTarget) {
      return
    }
    const { skillId, skillName, nextHidden } = availabilityTarget
    try {
      // 禁用 (nextHidden=true) hides the skill; 启用 (nextHidden=false) unhides it.
      if (nextHidden) {
        await hideMutation.mutateAsync({ skillId })
        toast.success(t('adminSkills.disableSuccessTitle'), t('adminSkills.disableSuccessDescription', { skill: skillName }))
      } else {
        await unhideMutation.mutateAsync({ skillId })
        toast.success(t('adminSkills.enableSuccessTitle'), t('adminSkills.enableSuccessDescription', { skill: skillName }))
      }
      setAvailabilityTarget(null)
    } catch (error) {
      // Keep the dialog open and leave the row untouched; the inventory only
      // updates from invalidated server state after a successful mutation.
      toast.error(t('adminSkills.actionErrorTitle'), error instanceof Error ? error.message : '')
    }
  }

  const openDeleteConfirm = (skill: AdminSkillSummary) => {
    setDeleteTarget({
      skillId: skill.id,
      skillName: skill.displayName || skill.slug,
      coordinate: `@${skill.namespace}/${skill.slug}`,
    })
  }

  const confirmSkillDelete = async () => {
    if (!deleteTarget || deleteInFlight) {
      return
    }
    const { skillId, skillName } = deleteTarget
    setDeleteInFlight(true)
    try {
      await hardDeleteMutation.mutateAsync({ skillId })
      toast.success(t('adminSkills.deleteSuccessTitle'), t('adminSkills.deleteSuccessDescription', { skill: skillName }))
      setDeleteTarget(null)
      setSelectedSkillId(null)
      // The server-side list shrank by one; step back if the current page no
      // longer exists instead of stranding the operator on an empty page.
      const lastValidPage = Math.max(0, Math.ceil((total - 1) / PAGE_SIZE) - 1)
      if (page > lastValidPage) {
        setPage(lastValidPage)
      }
    } catch (error) {
      // The shared ConfirmDialog closes itself once the attempt completes; the
      // detail modal and the inventory row stay untouched, and the row only
      // disappears after the server confirms the deletion.
      toast.error(t('adminSkills.actionErrorTitle'), error instanceof Error ? error.message : '')
    } finally {
      setDeleteInFlight(false)
    }
  }

  const skills = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = data && data.size > 0 ? Math.max(Math.ceil(data.total / data.size), 1) : 1
  const availabilityPending = hideMutation.isPending || unhideMutation.isPending
  const deletePending = deleteInFlight || hardDeleteMutation.isPending
  const selectedSkill = skills.find((skill) => skill.id === selectedSkillId) ?? null
  const detailQuery = useAdminSkillDetail(selectedSkillId, !!selectedSkill)
  const detail = detailQuery.data

  // Files load only while the 文件 tab is active, for one concrete version:
  // the published version when available, otherwise the headline version.
  const detailVersions = detail?.versions ?? []
  const currentFilesVersionId =
    detail?.skill.publishedVersion?.id
    ?? detail?.skill.headlineVersion?.id
    ?? detailVersions[0]?.id
    ?? null
  const effectiveFilesVersionId = selectedFilesVersionId ?? currentFilesVersionId
  const filesQuery = useAdminVersionFiles(
    selectedSkillId,
    effectiveFilesVersionId,
    activeTab === 'files' && !!selectedSkill && effectiveFilesVersionId !== null,
  )

  useEffect(() => {
    setActiveTab('overview')
    setSelectedFilesVersionId(null)
  }, [selectedSkillId])

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 animate-fade-up">
      <Card className="shrink-0 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1 space-y-1.5">
            <label className="text-sm font-medium" htmlFor="admin-skills-search">
              {t('adminSkills.searchLabel')}
            </label>
            <Input
              id="admin-skills-search"
              type="search"
              placeholder={t('adminSkills.searchPlaceholder')}
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  applySearch()
                }
              }}
              className="w-full"
            />
          </div>
          <div className="w-[200px] space-y-1.5">
            <label className="text-sm font-medium" htmlFor="admin-skills-category">
              {t('adminSkills.categoryFilterLabel')}
            </label>
            <Select
              value={normalizeSelectValue(labelFilter) ?? ALL_CATEGORIES_VALUE}
              onValueChange={(value) => setLabelFilter(value === ALL_CATEGORIES_VALUE ? '' : value)}
            >
              <SelectTrigger id="admin-skills-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_CATEGORIES_VALUE}>{t('adminSkills.categoryAll')}</SelectItem>
                {(labelDefinitions ?? []).map((definition) => (
                  <SelectItem key={definition.slug} value={definition.slug}>
                    {resolveLabelDisplayName(definition.translations, i18n.language, definition.slug)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-[180px] space-y-1.5">
            <label className="text-sm font-medium" htmlFor="admin-skills-state">
              {t('adminSkills.stateFilterLabel')}
            </label>
            <Select
              value={normalizeSelectValue(stateFilter) ?? ALL_STATES_VALUE}
              onValueChange={(value) => setStateFilter(value === ALL_STATES_VALUE ? '' : value)}
            >
              <SelectTrigger id="admin-skills-state">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_STATES_VALUE}>{t('adminSkills.stateAll')}</SelectItem>
                <SelectItem value="enabled">{t('adminSkills.stateEnabled')}</SelectItem>
                <SelectItem value="disabled">{t('adminSkills.stateDisabled')}</SelectItem>
                <SelectItem value="archived">{t('adminSkills.stateArchived')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {hasActiveFilters ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              data-testid="admin-skills-reset"
              className="mb-1"
            >
              {t('adminSkills.resetAction')}
            </Button>
          ) : null}
        </div>
      </Card>

      {isLoading ? (
        <div className="min-h-0 flex-1 space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-14 animate-shimmer rounded-lg" />
          ))}
        </div>
      ) : isError ? (
        <Card className="flex min-h-0 flex-1 items-center justify-center p-12 text-center">
          <p className="text-muted-foreground">{t('adminSkills.loadError')}</p>
        </Card>
      ) : skills.length === 0 ? (
        <Card className="flex min-h-0 flex-1 items-center justify-center p-12 text-center">
          <p className="text-muted-foreground">{t('adminSkills.empty')}</p>
        </Card>
      ) : (
        <>
          <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <Table
              className="table-fixed"
              wrapperClassName="min-h-0 flex-1 overflow-x-hidden overflow-y-auto [&_th]:px-3 [&_td]:px-3"
            >
              <colgroup>
                <col className="w-[26%]" />
                <col className="w-[15%]" />
                <col className="w-[17%]" />
                <col className="w-[12%]" />
                <col className="w-[15%]" />
                <col className="w-[15%]" />
              </colgroup>
              <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-card">
                <TableRow>
                  <TableHead>{t('adminSkills.colSkill')}</TableHead>
                  <TableHead>{t('adminSkills.colPublisher')}</TableHead>
                  <TableHead>{t('adminSkills.colCategory')}</TableHead>
                  <TableHead>{t('adminSkills.colStatus')}</TableHead>
                  <TableHead>{t('adminSkills.colUpdatedAt')}</TableHead>
                  <TableHead className="text-right">{t('adminSkills.colActions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {skills.map((skill) => {
                  const productState = resolveProductState(skill)
                  const skillName = skill.displayName || skill.slug
                  const labels = skill.labels ?? []
                  return (
                    <TableRow key={skill.id}>
                      <TableCell>
                        <button
                          type="button"
                          data-testid={`admin-skills-identity-${skill.id}`}
                          title={skillName}
                          onClick={() => setSelectedSkillId(skill.id)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              setSelectedSkillId(skill.id)
                            }
                          }}
                          className="block w-full rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                        >
                          <span className="block truncate font-medium">{skillName}</span>
                          <span className="block truncate font-mono text-xs text-muted-foreground">
                            @{skill.namespace}/{skill.slug}
                          </span>
                        </button>
                      </TableCell>
                      <TableCell>
                        <div className="truncate" title={skill.ownerDisplayName || undefined}>
                          {skill.ownerDisplayName || '-'}
                        </div>
                        {skill.ownerDisplayName && skill.ownerId ? (
                          <div className="truncate font-mono text-xs text-muted-foreground" title={skill.ownerId}>
                            {skill.ownerId}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {labels.length > 0 ? (
                          <div className="flex items-center gap-1.5" title={joinLabelDisplayNames(labels)}>
                            <span className="inline-flex max-w-full items-center truncate rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                              {labels[0].displayName}
                            </span>
                            {labels.length > 1 ? (
                              <span
                                className="whitespace-nowrap text-xs font-medium text-muted-foreground"
                                title={joinLabelDisplayNames(labels)}
                              >
                                {t('adminSkills.categoryMore', { n: labels.length - 1 })}
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="whitespace-nowrap text-xs text-muted-foreground">{t('adminSkills.noCategory')}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center whitespace-nowrap ${PRODUCT_STATE_BADGE_CLASSES[productState]}`}>
                          {t(PRODUCT_STATE_LABEL_KEYS[productState])}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {skill.updatedAt ? formatLocalDateTime(skill.updatedAt, i18n.language) : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {productState === 'archived' ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={availabilityPending}
                            onClick={() => openAvailabilityConfirm(skill.id, skillName, skill.hidden)}
                          >
                            {/* 禁用 when enabled (hidden=false), 启用 when disabled (hidden=true). */}
                            {productState === 'disabled' ? t('adminSkills.actionEnable') : t('adminSkills.actionDisable')}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Card>

          <div className="shrink-0">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                {t('adminSkills.totalRecords', { total, page: page + 1 })}
              </p>
            </div>
            {total > PAGE_SIZE ? (
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            ) : null}
          </div>
        </>
      )}

      <Dialog
        open={!!selectedSkill}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedSkillId(null)
          }
        }}
      >
        <DialogContent
          data-testid="admin-skills-detail-modal"
          className="flex max-h-[85vh] w-[min(92vw,60rem)] flex-col gap-0 overflow-hidden p-0"
        >
          {selectedSkill ? (
            <>
              <div className="shrink-0 border-b border-border px-6 pb-4 pt-6">
                <DialogTitle className="break-all pr-8 text-xl">
                  {selectedSkill.displayName || selectedSkill.slug}
                </DialogTitle>
                <p className="mt-1 break-all pr-8 font-mono text-xs text-muted-foreground">
                  @{selectedSkill.namespace}/{selectedSkill.slug}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center whitespace-nowrap ${PRODUCT_STATE_BADGE_CLASSES[resolveProductState(selectedSkill)]}`}>
                    {t(PRODUCT_STATE_LABEL_KEYS[resolveProductState(selectedSkill)])}
                  </span>
                  {(selectedSkill.labels ?? []).map((label) => (
                    <span
                      key={label.slug}
                      className="inline-flex items-center whitespace-nowrap rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
                    >
                      {label.displayName}
                    </span>
                  ))}
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                {detailQuery.isLoading ? (
                  <div className="space-y-3 py-2" data-testid="admin-skills-detail-loading">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div key={index} className="h-16 animate-shimmer rounded-lg" />
                    ))}
                  </div>
                ) : detailQuery.isError ? (
                  <div className="flex flex-col items-start gap-3 py-8" data-testid="admin-skills-detail-error">
                    <p className="text-sm text-muted-foreground">{t('adminSkills.detailLoadError')}</p>
                    <Button variant="outline" size="sm" onClick={() => detailQuery.refetch()}>
                      {t('adminSkills.detailRetry')}
                    </Button>
                  </div>
                ) : (
                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList>
                      <TabsTrigger value="overview">{t('adminSkills.detailTabOverview')}</TabsTrigger>
                      <TabsTrigger value="versions">{t('adminSkills.detailTabVersions')}</TabsTrigger>
                      <TabsTrigger value="files">{t('adminSkills.detailTabFiles')}</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="pt-4">
                      <section>
                        <h3 className="text-sm font-semibold">{t('adminSkills.skillIntroduction')}</h3>
                        <p className="mt-2 whitespace-pre-wrap rounded-xl bg-surface-muted p-4 text-sm leading-relaxed">
                          {detail?.summary && detail.summary.trim().length > 0
                            ? detail.summary
                            : t('adminSkills.detailEmptyIntroduction')}
                        </p>
                      </section>

                      <dl className="mt-5 grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
                        <div>
                          <dt className="text-xs text-muted-foreground">{t('adminSkills.colPublisher')}</dt>
                          <dd className="mt-1 break-all">{detail?.skill.ownerDisplayName || '-'}</dd>
                          {detail?.skill.ownerDisplayName && detail.skill.ownerId ? (
                            <dd className="break-all font-mono text-xs text-muted-foreground">{detail.skill.ownerId}</dd>
                          ) : null}
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">{t('adminSkills.detailVisibilityLabel')}</dt>
                          <dd className="mt-1">{resolveVisibilityText(detail?.skill.visibility, t)}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">{t('adminSkills.detailCreatedAtLabel')}</dt>
                          <dd className="mt-1">
                            {detail?.skill.createdAt ? formatLocalDateTime(detail.skill.createdAt, i18n.language) : '-'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">{t('adminSkills.colUpdatedAt')}</dt>
                          <dd className="mt-1">
                            {detail?.skill.updatedAt ? formatLocalDateTime(detail.skill.updatedAt, i18n.language) : '-'}
                          </dd>
                        </div>
                        <div className="sm:col-span-2">
                          <dt className="text-xs text-muted-foreground">{t('adminSkills.colCategory')}</dt>
                          <dd className="mt-1 flex flex-wrap gap-1.5">
                            {(detail?.skill.labels ?? []).map((label) => (
                              <span
                                key={label.slug}
                                className="inline-flex items-center whitespace-nowrap rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
                              >
                                {label.displayName}
                              </span>
                            ))}
                          </dd>
                        </div>
                        <div className="sm:col-span-2">
                          <dt className="text-xs text-muted-foreground">{t('adminSkills.detailVersionLabel')}</dt>
                          <dd className="mt-1 flex flex-wrap items-center gap-2">
                            {(() => {
                              const version = detail?.skill.headlineVersion ?? detail?.skill.publishedVersion
                              if (!version) {
                                return <span className="text-muted-foreground">{t('adminSkills.noVersion')}</span>
                              }
                              return (
                                <>
                                  <span className="whitespace-nowrap font-mono text-xs">v{version.version}</span>
                                  <VersionStatusBadge status={version.status} />
                                </>
                              )
                            })()}
                            {detail?.skill.headlineVersion && detail.skill.publishedVersion
                              && detail.skill.publishedVersion.id !== detail.skill.headlineVersion.id ? (
                                <span className="flex flex-wrap items-center gap-2">
                                  <span className="text-xs text-muted-foreground">
                                    {t('adminSkills.detailPublishedVersionLabel')}
                                  </span>
                                  <span className="whitespace-nowrap font-mono text-xs">v{detail.skill.publishedVersion.version}</span>
                                  <VersionStatusBadge status={detail.skill.publishedVersion.status} />
                                </span>
                              ) : null}
                          </dd>
                        </div>
                      </dl>
                    </TabsContent>

                    <TabsContent value="versions" className="pt-4">
                      {(detail?.versions?.length ?? 0) === 0 ? (
                        <p className="py-6 text-center text-sm text-muted-foreground">{t('adminSkills.noVersion')}</p>
                      ) : (
                        <div className="space-y-3">
                          {detail!.versions.map((version) => (
                            <div key={version.id} className="rounded-xl border border-border p-4">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="whitespace-nowrap font-mono text-sm">v{version.version}</span>
                                <VersionStatusBadge status={version.status} />
                                {version.publishedAt ? (
                                  <span className="ml-auto whitespace-nowrap text-xs text-muted-foreground">
                                    {t('adminSkills.versionColPublishedAt')}:
                                    {' '}
                                    {formatLocalDateTime(version.publishedAt, i18n.language)}
                                  </span>
                                ) : null}
                              </div>
                              {version.changelog ? (
                                <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                                  {t('adminSkills.versionColChangelog')}: {version.changelog}
                                </p>
                              ) : null}
                              <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                                <span>
                                  {t('adminSkills.versionColFiles')}: {version.fileCount ?? '-'}
                                </span>
                                <span>
                                  {t('adminSkills.versionColSize')}: {formatByteSize(version.totalSize)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="files" className="pt-4">
                      {detailVersions.length > 1 ? (
                        <div className="mb-3 w-[220px] space-y-1.5">
                          <label className="text-sm font-medium" htmlFor="admin-skills-files-version">
                            {t('adminSkills.filesVersionLabel')}
                          </label>
                          <Select
                            value={effectiveFilesVersionId != null ? String(effectiveFilesVersionId) : undefined}
                            onValueChange={(value) => setSelectedFilesVersionId(Number(value))}
                          >
                            <SelectTrigger id="admin-skills-files-version">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {detailVersions.map((version) => (
                                <SelectItem key={version.id} value={String(version.id)}>
                                  v{version.version}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : null}

                      {filesQuery.isLoading ? (
                        <div className="space-y-2 py-2" data-testid="admin-skills-files-loading">
                          {Array.from({ length: 3 }).map((_, index) => (
                            <div key={index} className="h-10 animate-shimmer rounded-lg" />
                          ))}
                        </div>
                      ) : filesQuery.isError ? (
                        <div className="flex flex-col items-start gap-3 py-6" data-testid="admin-skills-files-error">
                          <p className="text-sm text-muted-foreground">{t('adminSkills.filesLoadError')}</p>
                          <Button variant="outline" size="sm" onClick={() => filesQuery.refetch()}>
                            {t('adminSkills.detailRetry')}
                          </Button>
                        </div>
                      ) : (filesQuery.data ?? []).length === 0 ? (
                        <p
                          className="py-6 text-center text-sm text-muted-foreground"
                          data-testid="admin-skills-files-empty"
                        >
                          {t('adminSkills.filesEmpty')}
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {(filesQuery.data ?? []).map((file) => (
                            <div
                              key={file.id}
                              className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                            >
                              <span className="min-w-0 flex-1 truncate font-mono text-xs" title={file.filePath}>
                                {file.filePath}
                              </span>
                              <span className="whitespace-nowrap text-xs text-muted-foreground">
                                {formatByteSize(file.fileSize)}
                              </span>
                              {file.contentType ? (
                                <span className="whitespace-nowrap text-xs text-muted-foreground">
                                  {file.contentType}
                                </span>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                )}
              </div>

              <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border px-6 py-4">
                {resolveProductState(selectedSkill) === 'archived' ? (
                  <p className="text-xs text-muted-foreground">{t('adminSkills.detailArchivedHint')}</p>
                ) : (
                  <Button
                    variant={selectedSkill.hidden ? 'default' : 'outline'}
                    size="sm"
                    disabled={availabilityPending || deletePending}
                    onClick={() => openAvailabilityConfirm(selectedSkill.id, selectedSkill.displayName || selectedSkill.slug, selectedSkill.hidden)}
                  >
                    {selectedSkill.hidden ? t('adminSkills.actionEnableSkill') : t('adminSkills.actionDisableSkill')}
                  </Button>
                )}
                <div className="flex items-center gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    data-testid="admin-skills-detail-delete"
                    disabled={deletePending}
                    onClick={() => openDeleteConfirm(selectedSkill)}
                  >
                    {t('adminSkills.actionDeleteSkill')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    data-testid="admin-skills-detail-close"
                    onClick={() => setSelectedSkillId(null)}
                  >
                    {t('adminSkills.detailClose')}
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!availabilityTarget}
        onOpenChange={(open) => {
          if (!open) {
            setAvailabilityTarget(null)
          }
        }}
        title={
          availabilityTarget?.nextHidden
            ? t('adminSkills.confirmDisableTitle')
            : t('adminSkills.confirmEnableTitle')
        }
        description={
          availabilityTarget?.nextHidden
            ? t('adminSkills.confirmDisableDescription', { skill: availabilityTarget.skillName })
            : t('adminSkills.confirmEnableDescription', { skill: availabilityTarget?.skillName })
        }
        confirmText={
          availabilityTarget?.nextHidden ? t('adminSkills.actionDisable') : t('adminSkills.actionEnable')
        }
        variant="destructive"
        onConfirm={confirmAvailabilityChange}
        confirmButtonTestId="admin-skills-confirm"
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null)
          }
        }}
        title={t('adminSkills.confirmDeleteTitle')}
        description={t('adminSkills.confirmDeleteDescription', {
          skill: deleteTarget?.skillName,
          coordinate: deleteTarget?.coordinate,
        })}
        confirmText={t('adminSkills.actionDelete')}
        variant="destructive"
        onConfirm={confirmSkillDelete}
        contentTestId="admin-skills-delete-dialog"
        confirmButtonTestId="admin-skills-delete-confirm"
      />
    </div>
  )
}
