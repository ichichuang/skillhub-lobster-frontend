import { useEffect, useRef, useState } from 'react'
import { useSearch } from '@tanstack/react-router'
import { AlertTriangle, Ban, CheckCircle2, FileArchive, Loader2, XCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { UploadZone } from '@/features/publish/upload-zone'
import { packageFolderAsZip } from '@/features/publish/folder-zip'
import {
  addFilesToPublishQueue,
  getPublishFileId,
  removeQueuedPublishQueueItem,
  runPublishBatch,
  type PublishBatchWarningDecision,
  type PublishQueueItem,
  type PublishQueueStatus,
} from '@/features/publish/publish-batch'
import { runPackagePreflight, type PackagePreflightResult, type PreflightCheck } from '@/features/publish/package-preflight'
import { matchServerPreflightFailure, type ServerPreflightFailureKind } from '@/features/publish/publish-error-utils'
import { normalizePublishPrefill } from '@/features/publish/publish-prefill'
import { Button } from '@/shared/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  normalizeSelectValue,
} from '@/shared/ui/select'
import { Label } from '@/shared/ui/label'
import { Card } from '@/shared/ui/card'
import { usePublishSkill } from '@/shared/hooks/use-skill-queries'
import { useMyNamespaces } from '@/shared/hooks/use-namespace-queries'
import { ConfirmDialog } from '@/shared/components/confirm-dialog'
import { DashboardPageHeader } from '@/shared/components/dashboard-page-header'
import { toast } from '@/shared/lib/toast'

const EMPTY_NAMESPACE_VALUE = '__select_namespace__'

interface BatchSummary {
  succeeded: number
  failed: number
}

const STATUS_CLASS_NAMES: Record<PublishQueueStatus, string> = {
  pending: 'text-muted-foreground',
  publishing: 'text-blue-600 dark:text-blue-400',
  succeeded: 'text-emerald-600 dark:text-emerald-400',
  failed: 'text-destructive',
  'warning-confirmation-required': 'text-amber-600 dark:text-amber-400',
  blocked: 'text-destructive',
}

function PublishStatusIcon({ status }: { status: PublishQueueStatus }) {
  const className = `h-4 w-4 flex-shrink-0 ${STATUS_CLASS_NAMES[status]}`
  if (status === 'publishing') {
    return <Loader2 className={`${className} animate-spin`} aria-hidden="true" />
  }
  if (status === 'succeeded') {
    return <CheckCircle2 className={className} aria-hidden="true" />
  }
  if (status === 'failed') {
    return <XCircle className={className} aria-hidden="true" />
  }
  if (status === 'warning-confirmation-required') {
    return <AlertTriangle className={className} aria-hidden="true" />
  }
  if (status === 'blocked') {
    return <Ban className={className} aria-hidden="true" />
  }
  return <FileArchive className={className} aria-hidden="true" />
}

function PackageCheckRow({ check }: { check: PreflightCheck }) {
  const { t } = useTranslation()
  return (
    <li className="space-y-0.5">
      <div className="flex items-center gap-1.5">
        {check.passed ? (
          <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-emerald-500" aria-hidden="true" />
        ) : (
          <XCircle className="h-3.5 w-3.5 flex-shrink-0 text-destructive" aria-hidden="true" />
        )}
        <span className="text-xs text-foreground">{t(check.labelKey)}</span>
      </div>
      {check.failure ? (
        <p className="pl-5 text-xs text-destructive">{t(check.failure.messageKey, check.failure.params)}</p>
      ) : null}
    </li>
  )
}

function PackagePreflightSection({ preflight }: { preflight: PackagePreflightResult }) {
  const { t } = useTranslation()
  const { metadata, checks, blocked, failure } = preflight
  const hasSkillInfo = Boolean(metadata.name || metadata.description || metadata.version)

  if (failure && !hasSkillInfo) {
    return (
      <div className="mt-2 pl-6" role="alert">
        <div className="flex items-start gap-1.5">
          <XCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-destructive" aria-hidden="true" />
          <p className="text-xs text-destructive">{t(failure.messageKey)}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-2 space-y-3 pl-6">
      {hasSkillInfo ? (
        <div
          className="rounded-lg border border-border/60 bg-background/60 p-3"
          role="group"
          aria-label={t('publish.preflight.skillInfoTitle')}
        >
          <p className="text-xs font-semibold text-foreground">{t('publish.preflight.skillInfoTitle')}</p>
          {metadata.name ? (
            <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
              <span className="text-xs text-muted-foreground">{t('publish.preflight.skillNameLabel')}</span>
              <span className="text-sm font-medium text-foreground">{metadata.name}</span>
            </div>
          ) : null}
          {metadata.description ? (
            <div className="mt-1.5">
              <span className="text-xs text-muted-foreground">{t('publish.preflight.skillDescriptionLabel')}</span>
              <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
                {metadata.description}
              </p>
            </div>
          ) : null}
          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
            <span className="text-xs text-muted-foreground">{t('publish.preflight.skillVersionLabel')}</span>
            {metadata.version ? (
              <span className="text-xs font-medium text-foreground">{metadata.version}</span>
            ) : (
              <span className="text-xs text-muted-foreground">{t('publish.preflight.versionMissing')}</span>
            )}
          </div>
        </div>
      ) : null}

      {checks.length > 0 ? (
        <div aria-label={t('publish.preflight.checksTitle')}>
          <p className="text-xs font-semibold text-foreground">{t('publish.preflight.checksTitle')}</p>
          <ul className="mt-1.5 space-y-1.5">
            {checks.map((check) => <PackageCheckRow key={check.id} check={check} />)}
          </ul>
          {blocked ? (
            <div className="mt-2 rounded-lg bg-secondary/50 p-2.5">
              <p className="text-xs text-muted-foreground">{t('publish.preflight.exampleHint')}</p>
              <pre className="mt-1 overflow-x-auto text-xs text-foreground">{t('publish.preflight.frontmatterExample')}</pre>
            </div>
          ) : null}
          <p className={`mt-2 text-xs ${blocked ? 'text-destructive' : 'text-muted-foreground'}`}>
            {blocked ? t('publish.preflight.blockedNote') : t('publish.preflight.passedNote')}
          </p>
        </div>
      ) : null}
    </div>
  )
}

export function PublishPage() {
  const { t } = useTranslation()
  const search = useSearch({ from: '/dashboard/publish' })
  const prefill = normalizePublishPrefill(search)
  const [queueItems, setQueueItems] = useState<PublishQueueItem[]>([])
  const [namespaceSlug, setNamespaceSlug] = useState<string>(prefill.namespace)
  const [visibility, setVisibility] = useState<string>(prefill.visibility)
  const [isBatchPublishing, setIsBatchPublishing] = useState(false)
  const [isPackaging, setIsPackaging] = useState(false)
  const [warningItem, setWarningItem] = useState<PublishQueueItem | null>(null)
  const [batchSummary, setBatchSummary] = useState<BatchSummary | null>(null)
  const batchPublishingRef = useRef(false)
  const warningDecisionRef = useRef<((decision: PublishBatchWarningDecision) => void) | null>(null)

  const { data: namespaces, isLoading: isLoadingNamespaces } = useMyNamespaces()
  const publishMutation = usePublishSkill()
  const selectedNamespace = namespaces?.find((ns) => ns.slug === namespaceSlug)
  const namespaceOnlyLabel = selectedNamespace?.type === 'GLOBAL'
    ? t('publish.visibilityOptions.loggedInUsersOnly')
    : t('publish.visibilityOptions.namespaceOnly')
  const pendingCount = queueItems.filter((item) => item.status === 'pending').length

  useEffect(() => {
    if (!batchPublishingRef.current) {
      setNamespaceSlug(prefill.namespace)
      setVisibility(prefill.visibility)
    }
  }, [prefill.namespace, prefill.visibility])

  const runPreflightForFiles = async (files: File[]) => {
    for (const file of files) {
      const itemId = getPublishFileId(file)
      const result = await runPackagePreflight(file)
      setQueueItems((items) => items.map((item) => {
        if (item.id !== itemId) {
          return item
        }
        const updated = { ...item, preflight: result }
        return updated.status === 'pending' && result.blocked
          ? { ...updated, status: 'blocked' as const }
          : updated
      }))
    }
  }

  const handleFilesSelect = (files: File[]) => {
    if (batchPublishingRef.current) return
    const addedIds = new Set(files.map((file) => getPublishFileId(file)))
    setQueueItems((items) => addFilesToPublishQueue(items, files).map((item) => (
      item.preflight || !addedIds.has(item.id) ? item : { ...item, preflight: { state: 'checking' as const } }
    )))
    setBatchSummary(null)
    void runPreflightForFiles(files)
  }

  const handleFolderSelect = async (files: File[]) => {
    setIsPackaging(true)
    try {
      const zip = await packageFolderAsZip(files)
      handleFilesSelect([zip])
    } catch {
      toast.error(t('publish.folderPackagingFailed'))
    } finally {
      setIsPackaging(false)
    }
  }

  const handleRemoveFile = (itemId: string) => {
    if (batchPublishingRef.current) return
    setQueueItems((items) => removeQueuedPublishQueueItem(items, itemId))
  }

  const handleClearQueue = () => {
    if (batchPublishingRef.current) return
    setQueueItems([])
    setBatchSummary(null)
  }

  const requestWarningDecision = (item: PublishQueueItem) => (
    new Promise<PublishBatchWarningDecision>((resolve) => {
      warningDecisionRef.current = resolve
      setWarningItem(item)
    })
  )

  const settleWarningDecision = (decision: PublishBatchWarningDecision) => {
    const resolve = warningDecisionRef.current
    if (!resolve) return
    warningDecisionRef.current = null
    setWarningItem(null)
    resolve(decision)
  }

  const handlePublish = async () => {
    if (batchPublishingRef.current) return
    if (pendingCount === 0 || !namespaceSlug) {
      toast.error(t('publish.selectRequired'))
      return
    }

    const executionIds = new Set(
      queueItems.filter((item) => item.status === 'pending').map((item) => item.id),
    )
    const executionNamespace = namespaceSlug
    const executionVisibility = visibility
    batchPublishingRef.current = true
    setIsBatchPublishing(true)
    setBatchSummary(null)

    try {
      const completedItems = await runPublishBatch({
        items: queueItems,
        namespace: executionNamespace,
        visibility: executionVisibility,
        publish: publishMutation.mutateAsync,
        onItemsChange: setQueueItems,
        requestWarningDecision,
      })
      const executionItems = completedItems.filter((item) => executionIds.has(item.id))
      const summary = {
        succeeded: executionItems.filter((item) => item.status === 'succeeded').length,
        failed: executionItems.filter((item) => item.status === 'failed').length,
      }
      setQueueItems(completedItems)
      setBatchSummary(summary)
      const summaryText = t('publish.batchSummary', summary)
      if (summary.failed > 0) {
        toast.error(t('publish.batchCompletedWithErrors'), summaryText)
      } else {
        toast.success(t('publish.batchCompleted'), summaryText)
      }
    } finally {
      batchPublishingRef.current = false
      setIsBatchPublishing(false)
    }
  }

  const getServerPreflightCopy = (kind: ServerPreflightFailureKind) => {
    switch (kind) {
      case 'skill-md-missing':
        return { title: t('publish.preflight.skillMdErrorTitle'), description: t('publish.preflight.skillMdMissing') }
      case 'skill-md-ambiguous':
        return { title: t('publish.preflight.skillMdAmbiguousTitle'), description: t('publish.preflight.skillMdAmbiguous') }
      case 'name-missing':
        return { title: t('publish.preflight.nameErrorTitle'), description: t('publish.preflight.nameMissing') }
      case 'name-invalid':
        return { title: t('publish.preflight.nameErrorTitle'), description: t('publish.preflight.nameInvalidPattern') }
      case 'description-missing':
        return { title: t('publish.preflight.descriptionErrorTitle'), description: t('publish.preflight.descriptionMissing') }
      case 'frontmatter-invalid':
        return { title: t('publish.frontmatterFailedTitle'), description: t('publish.preflight.frontmatterInvalid') }
    }
  }

  const getErrorCopy = (item: PublishQueueItem) => {
    const error = item.error
    if (!error) return null

    const serverPreflightKind = matchServerPreflightFailure(error.message)
    if (serverPreflightKind) {
      return getServerPreflightCopy(serverPreflightKind)
    }

    switch (error.kind) {
      case 'timeout':
        return { title: t('publish.timeoutTitle'), description: t('publish.timeoutDescription') }
      case 'version-exists':
        return { title: t('publish.versionExistsTitle'), description: t('publish.versionExistsDescription') }
      case 'precheck':
        return { title: t('publish.precheckFailedTitle'), description: error.message || t('publish.precheckFailedDescription') }
      case 'frontmatter':
        return { title: t('publish.frontmatterFailedTitle'), description: error.message || t('publish.frontmatterFailedDescription') }
      case 'warning-cancelled':
        return {
          title: t('publish.errorTypes.warningCancelledTitle'),
          description: t('publish.errorTypes.warningCancelledDescription'),
        }
      case 'generic':
        return { title: t('publish.error'), description: error.message }
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 animate-fade-up">
      <DashboardPageHeader title={t('publish.title')} subtitle={t('publish.subtitle')} />

      <Card className="space-y-8 p-6 md:p-8">
        {prefill.resubmitSkill && prefill.resubmitVersion ? (
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
            <h2 className="text-sm font-semibold text-foreground">
              {t('publish.resubmitNotice.title', {
                skill: `@${prefill.namespace}/${prefill.resubmitSkill}`,
                version: prefill.resubmitVersion,
              })}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('publish.resubmitNotice.description')}
            </p>
          </div>
        ) : null}
        <div className="flex items-start gap-3 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
          <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1">
            <h3 className="mb-1 text-sm font-semibold text-foreground">{t('publish.reviewNotice.title')}</h3>
            <p className="text-sm text-muted-foreground">{t('publish.reviewNotice.description')}</p>
          </div>
        </div>
        <div className="space-y-3">
          <Label htmlFor="namespace" className="text-sm font-semibold font-heading">{t('publish.namespace')}</Label>
          {isLoadingNamespaces ? (
            <div className="h-11 animate-shimmer rounded-lg" />
          ) : (
            <Select
              value={normalizeSelectValue(namespaceSlug) ?? EMPTY_NAMESPACE_VALUE}
              disabled={isBatchPublishing}
              onValueChange={(value) => {
                if (!batchPublishingRef.current) {
                  setNamespaceSlug(value === EMPTY_NAMESPACE_VALUE ? '' : value)
                }
              }}
            >
              <SelectTrigger id="namespace" disabled={isBatchPublishing}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={EMPTY_NAMESPACE_VALUE}>{t('publish.selectNamespace')}</SelectItem>
                {namespaces?.map((ns) => (
                  <SelectItem key={ns.id} value={ns.slug}>
                    {ns.displayName} (@{ns.slug})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="space-y-3">
          <Label htmlFor="visibility" className="text-sm font-semibold font-heading">{t('publish.visibility')}</Label>
          <Select
            value={visibility}
            disabled={isBatchPublishing}
            onValueChange={(value) => {
              if (!batchPublishingRef.current) setVisibility(value)
            }}
          >
            <SelectTrigger id="visibility" disabled={isBatchPublishing}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PUBLIC">{t('publish.visibilityOptions.public')}</SelectItem>
              <SelectItem value="NAMESPACE_ONLY">{namespaceOnlyLabel}</SelectItem>
              <SelectItem value="PRIVATE">{t('publish.visibilityOptions.private')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-semibold font-heading">{t('publish.file')}</Label>
          <UploadZone
            onFilesSelect={handleFilesSelect}
            onFolderSelect={handleFolderSelect}
            disabled={isBatchPublishing || isPackaging}
          />

          {queueItems.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-foreground">
                  {t('publish.queueCount', { count: queueItems.length })}
                </p>
                <Button type="button" variant="ghost" size="sm" onClick={handleClearQueue} disabled={isBatchPublishing}>
                  {batchSummary ? t('publish.startAnotherBatch') : t('publish.clearQueue')}
                </Button>
              </div>

              <div className="space-y-2" role="list" aria-label={t('publish.queueLabel')}>
                {queueItems.map((item) => {
                  const errorCopy = getErrorCopy(item)
                  const skillLabel = item.result
                    ? `${item.result.namespace}/${item.result.slug}@${item.result.version}`
                    : null

                  return (
                    <div key={item.id} role="listitem" className="rounded-lg border border-border/60 bg-secondary/30 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <PublishStatusIcon status={item.status} />
                            <span className="truncate text-sm font-medium text-foreground">{item.file.name}</span>
                            <span className="flex-shrink-0 text-xs text-muted-foreground">
                              ({(item.file.size / 1024).toFixed(1)} KB)
                            </span>
                          </div>
                          <p className={`mt-1 pl-6 text-xs font-medium ${STATUS_CLASS_NAMES[item.status]}`}>
                            {t(`publish.status.${item.status}`)}
                          </p>

                          {item.preflight?.state === 'checking' ? (
                            <p className="mt-2 pl-6 text-xs text-muted-foreground">{t('publish.preflight.checking')}</p>
                          ) : null}
                          {item.preflight && item.preflight.state === 'ready' ? (
                            <PackagePreflightSection preflight={item.preflight} />
                          ) : null}
                          {item.preflight && item.preflight.state === 'unreadable' ? (
                            <p className="mt-2 pl-6 text-xs text-muted-foreground">{t('publish.preflight.unreadableNote')}</p>
                          ) : null}

                          {item.result && skillLabel ? (
                            <div className="mt-2 pl-6 text-xs text-muted-foreground">
                              <p className="font-medium text-foreground">
                                {item.result.status === 'PUBLISHED' ? t('publish.publishedTitle') : t('publish.pendingReviewTitle')}
                              </p>
                              <p>
                                {item.result.status === 'PUBLISHED'
                                  ? t('publish.publishedDescription', { skill: skillLabel })
                                  : t('publish.pendingReviewDescription', { skill: skillLabel })}
                              </p>
                            </div>
                          ) : null}

                          {errorCopy ? (
                            <div className="mt-2 pl-6 text-xs text-destructive" role="alert">
                              <p className="font-medium">{errorCopy.title}</p>
                              {errorCopy.description ? <p>{errorCopy.description}</p> : null}
                            </div>
                          ) : null}
                        </div>

                        {item.status === 'pending' || item.status === 'blocked' ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveFile(item.id)}
                            disabled={isBatchPublishing}
                            aria-label={t('publish.removeFile', { file: item.file.name })}
                          >
                            {t('publish.remove')}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>

        {batchSummary ? (
          <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground" role="status" aria-live="polite">
            <p className="font-semibold">{t('publish.batchCompleted')}</p>
            <p className="text-muted-foreground">
              {t('publish.batchSummary', {
                succeeded: batchSummary.succeeded,
                failed: batchSummary.failed,
              })}
            </p>
          </div>
        ) : null}

        <Button
          className="w-full text-primary-foreground disabled:text-primary-foreground"
          size="lg"
          onClick={handlePublish}
          disabled={pendingCount === 0 || !namespaceSlug || isBatchPublishing}
        >
          {isBatchPublishing ? t('publish.publishingBatch') : t('publish.confirm')}
        </Button>
      </Card>

      <ConfirmDialog
        open={warningItem !== null}
        onOpenChange={(open) => {
          if (!open) settleWarningDecision('cancel')
        }}
        title={t('publish.warningConfirmTitle')}
        description={warningItem ? (
          <div className="space-y-3 text-left">
            <p className="font-medium text-foreground">{t('publish.warningConfirmFile', { file: warningItem.file.name })}</p>
            <p>{t('publish.warningConfirmDescription')}</p>
            {warningItem.warnings && warningItem.warnings.length > 0 ? (
              <ul className="list-disc space-y-1 pl-5">
                {warningItem.warnings.map((warning) => <li key={warning}>{warning}</li>)}
              </ul>
            ) : null}
          </div>
        ) : undefined}
        confirmText={t('publish.warningConfirmContinue')}
        cancelText={t('publish.warningConfirmCancel')}
        onConfirm={() => settleWarningDecision('confirm')}
      />
    </div>
  )
}
