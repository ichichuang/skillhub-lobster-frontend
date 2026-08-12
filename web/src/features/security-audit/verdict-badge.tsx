import { useTranslation } from 'react-i18next'
import type { SecurityAuditDisplayState, SecurityVerdict } from './types'

interface VerdictBadgeProps {
  verdict?: SecurityVerdict
  displayState?: SecurityAuditDisplayState
}

export function VerdictBadge({ verdict, displayState }: VerdictBadgeProps) {
  const { t } = useTranslation()
  const state = displayState ?? verdict

  if (!state) {
    return null
  }

  const styles = {
    SCANNING: 'bg-info-surface text-info',
    SCAN_FAILED: 'bg-danger-surface text-danger',
    SAFE: 'bg-success-surface text-success',
    SUSPICIOUS: 'bg-warning-surface text-warning',
    DANGEROUS: 'bg-danger-surface text-danger',
    BLOCKED: 'bg-danger-surface text-danger',
  }

  const label = state === 'SCANNING'
    ? t('securityAudit.statusScanning')
    : state === 'SCAN_FAILED'
      ? t('securityAudit.statusScanFailed')
      : t(`securityAudit.verdict.${state}`)

  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-sm font-medium ${styles[state]}`}
    >
      {label}
    </span>
  )
}
