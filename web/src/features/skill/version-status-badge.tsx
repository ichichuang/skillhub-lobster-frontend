import { useTranslation } from 'react-i18next'
import { cn } from '@/shared/lib/utils'

type VersionStatus =
  | 'DRAFT'
  | 'SCANNING'
  | 'SCAN_FAILED'
  | 'UPLOADED'
  | 'PENDING_REVIEW'
  | 'PUBLISHED'
  | 'REJECTED'
  | 'YANKED'

const statusStyles: Record<VersionStatus, string> = {
  PUBLISHED:
    'border-success/30 bg-success-surface text-success',
  UPLOADED:
    'border-info/30 bg-info-surface text-info',
  PENDING_REVIEW:
    'border-warning/30 bg-warning-surface text-warning',
  REJECTED:
    'border-danger/30 bg-danger-surface text-danger',
  SCANNING:
    'border-info/30 bg-info-surface text-info',
  SCAN_FAILED:
    'border-danger/30 bg-danger-surface text-danger',
  YANKED:
    'border-border/60 bg-secondary/40 text-muted-foreground',
  DRAFT:
    'border-border/60 bg-secondary/40 text-muted-foreground',
}

const i18nKeys: Record<VersionStatus, string> = {
  DRAFT: 'skillDetail.versionStatusDraft',
  SCANNING: 'skillDetail.versionStatusScanning',
  SCAN_FAILED: 'skillDetail.versionStatusScanFailed',
  UPLOADED: 'skillDetail.versionStatusUploaded',
  PENDING_REVIEW: 'skillDetail.versionStatusPendingReview',
  PUBLISHED: 'skillDetail.versionStatusPublished',
  REJECTED: 'skillDetail.versionStatusRejected',
  YANKED: 'skillDetail.versionStatusYanked',
}

/** Color-coded row styles (left-border + subtle background) for version cards. */
export const versionRowStyles: Record<VersionStatus, string> = {
  UPLOADED:
    'border-l-[3px] !border-l-info bg-info-surface',
  PENDING_REVIEW:
    'border-l-[3px] !border-l-warning bg-warning-surface',
  REJECTED:
    'border-l-[3px] !border-l-danger bg-danger-surface',
  SCANNING:
    'border-l-[3px] !border-l-info bg-info-surface',
  SCAN_FAILED:
    'border-l-[3px] !border-l-danger bg-danger-surface',
  PUBLISHED: '',
  YANKED: '',
  DRAFT: '',
}

export function getVersionRowStyle(status?: string): string {
  if (!status) return ''
  return versionRowStyles[status as VersionStatus] ?? ''
}

export function VersionStatusBadge({
  status,
  className,
}: {
  status?: string
  className?: string
}) {
  const { t } = useTranslation()
  if (!status) return null

  const style = statusStyles[status as VersionStatus] ?? statusStyles.DRAFT
  const label = i18nKeys[status as VersionStatus]
    ? t(i18nKeys[status as VersionStatus])
    : status

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        style,
        className,
      )}
    >
      {label}
    </span>
  )
}
