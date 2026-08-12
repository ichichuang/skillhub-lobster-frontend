import { useTranslation } from 'react-i18next'
import type { FindingSeverity } from './types'

interface SeverityBadgeProps {
  severity: FindingSeverity
}

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  const { t } = useTranslation()

  const styles = {
    CRITICAL: 'bg-danger-surface text-danger',
    HIGH: 'bg-danger-surface text-danger',
    MEDIUM: 'bg-warning-surface text-warning',
    LOW: 'bg-info-surface text-info',
    INFO: 'bg-surface-muted text-muted-foreground',
  }

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[severity]}`}
    >
      {t(`securityAudit.severity.${severity}`)}
    </span>
  )
}
