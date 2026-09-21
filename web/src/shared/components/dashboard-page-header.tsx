interface DashboardPageHeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

/**
 * Standard page header for dashboard sub-pages: title, optional subtitle, and page-level actions.
 */
export function DashboardPageHeader({ title, subtitle, actions }: DashboardPageHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <h1 className="text-4xl font-bold font-heading mb-2">{title}</h1>
        {subtitle ? <p className="text-muted-foreground text-lg">{subtitle}</p> : null}
      </div>
      {actions}
    </div>
  )
}
