import { createPortal } from 'react-dom'
import { Toaster as Sonner } from 'sonner'
import { getPortalContainer } from '@/shared/lib/portal-container'
import { CENTER_TOASTER_ID } from '@/shared/lib/toast'

export function Toaster() {
  const node = (
    <div translate="no">
      <Sonner
        id={CENTER_TOASTER_ID}
        position="top-center"
        className="!left-1/2 !right-auto !top-4 !-translate-x-1/2 !z-[100]"
        offset={16}
        mobileOffset={16}
        toastOptions={{
          toasterId: CENTER_TOASTER_ID,
          classNames: {
            toast: 'mx-auto w-fit max-w-[min(100vw-2rem,32rem)] border border-border bg-popover text-popover-foreground shadow-popover',
            title: 'text-foreground font-semibold text-center',
            description: 'text-muted-foreground text-center',
            content: 'w-full text-center',
            actionButton: 'bg-primary text-primary-foreground',
            cancelButton: 'bg-muted text-muted-foreground',
            error: 'border-danger bg-danger-surface',
            success: 'border-success bg-success-surface',
            warning: 'border-warning bg-warning-surface',
            info: 'border-info bg-info-surface',
          },
        }}
      />
    </div>
  )

  const host = typeof document !== 'undefined' ? getPortalContainer() : undefined
  if (host) {
    return createPortal(node, host)
  }
  return node
}
