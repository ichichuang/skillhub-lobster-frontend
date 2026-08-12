import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from '@tanstack/react-router'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { useCopyToClipboard } from '@/shared/lib/clipboard'
import { resolvePublicRegistryUrl } from '@/shared/lib/registry-url'

interface InstallCommandProps {
  namespace: string
  slug: string
  visibility?: string
  publishedVersion?: string
}

export type InstallState = 'ANONYMOUS_INSTALL' | 'AUTHENTICATED_INSTALL' | 'NOT_INSTALLABLE'

export function resolveInstallState(visibility: string | undefined, publishedVersion: string | undefined): InstallState {
  if (!publishedVersion) {
    return 'NOT_INSTALLABLE'
  }
  return visibility === 'PUBLIC' ? 'ANONYMOUS_INSTALL' : 'AUTHENTICATED_INSTALL'
}

export function buildInstallTarget(namespace: string, slug: string): string {
  return namespace === 'global' ? slug : `${namespace}--${slug}`
}

export function getBaseUrl(): string {
  if (typeof window === 'undefined') {
    return ''
  }
  const runtimeConfig = window.__SKILLHUB_RUNTIME_CONFIG__
  return resolvePublicRegistryUrl(
    runtimeConfig?.appBaseUrl,
    `${window.location.protocol}//${window.location.host}`,
  )
}

export function buildInstallCommand(namespace: string, slug: string, baseUrl: string): string {
  const installTarget = buildInstallTarget(namespace, slug)
  return `npx clawhub install ${installTarget} --registry ${baseUrl}`
}

export function buildSkillhubInstallCommand(namespace: string, slug: string, baseUrl: string): string {
  const namespaceArg = namespace === 'global' ? '' : ` --namespace ${namespace}`
  return `npx @astron-team/skillhub@latest install ${slug}${namespaceArg} --registry ${baseUrl}`
}

export function buildBrowserLoginCommand(baseUrl: string): string {
  return `npx clawhub --site ${baseUrl} --registry ${baseUrl} login`
}

export function buildWhoamiCommand(baseUrl: string): string {
  return `npx clawhub --registry ${baseUrl} whoami`
}

export function buildTokenLoginCommand(baseUrl: string): string {
  return `npx clawhub --registry ${baseUrl} login --token YOUR_API_TOKEN`
}

interface CommandBlockProps {
  command: string
}

function CommandBlock({ command }: CommandBlockProps) {
  const { t } = useTranslation()
  const [copied, copy] = useCopyToClipboard()

  const handleCopy = async () => {
    try {
      await copy(command)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-border/60 bg-muted/50">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleCopy}
        title={copied ? t('copyButton.copied') : t('copyButton.copy')}
        aria-label={copied ? t('copyButton.copied') : t('copyButton.copy')}
        className="absolute right-2 top-2 z-10 h-8 w-8 rounded-md bg-background/80 backdrop-blur hover:bg-background"
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </Button>
      <pre className="px-4 py-3 pr-14 whitespace-pre-wrap break-all">
        <code className="font-mono text-[13px] leading-relaxed text-foreground whitespace-pre-wrap break-all sm:text-sm">
          {command}
        </code>
      </pre>
    </div>
  )
}

interface TroubleshootingProps {
  baseUrl: string
}

function Troubleshooting({ baseUrl }: TroubleshootingProps) {
  const { t } = useTranslation()
  const whoamiCommand = buildWhoamiCommand(baseUrl)
  const tokenLoginCommand = buildTokenLoginCommand(baseUrl)

  return (
    <details className="group rounded-xl border border-border/60 bg-muted/20">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-foreground marker:text-muted-foreground">
        {t('skillDetail.installGuide.troubleshooting')}
      </summary>
      <div className="space-y-4 border-t border-border/50 px-4 py-4">
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">{t('skillDetail.installGuide.checkLogin')}</p>
          <CommandBlock command={whoamiCommand} />
        </div>
        <ul className="space-y-2 text-sm leading-relaxed text-muted-foreground">
          <li>{t('skillDetail.installGuide.error401')}</li>
          <li>{t('skillDetail.installGuide.error403')}</li>
          <li>{t('skillDetail.installGuide.error404')}</li>
          <li>{t('skillDetail.installGuide.errorRedirect')}</li>
          <li>{t('skillDetail.installGuide.errorNetwork')}</li>
        </ul>
        <details className="rounded-lg border border-border/50 bg-background/50">
          <summary className="cursor-pointer px-3 py-2.5 text-sm font-medium text-foreground marker:text-muted-foreground">
            {t('skillDetail.installGuide.advancedToken')}
          </summary>
          <div className="space-y-3 border-t border-border/40 px-3 py-3">
            <p className="text-sm text-muted-foreground">
              {t('skillDetail.installGuide.advancedTokenDescription')}
            </p>
            <Link to="/dashboard/tokens" className="inline-flex text-sm font-medium text-primary hover:underline">
              {t('skillDetail.installGuide.manageTokens')}
            </Link>
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">{t('skillDetail.installGuide.tokenLogin')}</p>
              <CommandBlock command={tokenLoginCommand} />
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t('skillDetail.installGuide.tokenSafety')}
            </p>
          </div>
        </details>
      </div>
    </details>
  )
}

export function InstallCommand({ namespace, slug, visibility, publishedVersion }: InstallCommandProps) {
  const { t } = useTranslation()
  const baseUrl = useMemo(() => getBaseUrl(), [])
  const installState = resolveInstallState(visibility, publishedVersion)

  if (installState === 'NOT_INSTALLABLE') {
    return <p className="text-sm text-muted-foreground">{t('skillDetail.installGuide.notInstallable')}</p>
  }

  const clawhubCommand = buildInstallCommand(namespace, slug, baseUrl)
  const isAnonymousInstall = installState === 'ANONYMOUS_INSTALL'

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t(isAnonymousInstall
          ? 'skillDetail.installGuide.anonymousStatus'
          : 'skillDetail.installGuide.authenticatedStatus')}
      </p>

      {!isAnonymousInstall && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">{t('skillDetail.installGuide.loginStep')}</p>
          <CommandBlock command={buildBrowserLoginCommand(baseUrl)} />
        </div>
      )}

      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">
          {t('skillDetail.installGuide.installStep', { step: isAnonymousInstall ? 1 : 2 })}
        </p>
        <CommandBlock command={clawhubCommand} />
      </div>

      <Troubleshooting baseUrl={baseUrl} />

      {isAnonymousInstall && (
        <details className="rounded-xl border border-border/60 bg-muted/20">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-foreground marker:text-muted-foreground">
            {t('skillDetail.installGuide.otherMethods')}
          </summary>
          <div className="space-y-3 border-t border-border/50 px-4 py-4">
            <p className="text-sm text-muted-foreground">{t('skillDetail.installGuide.skillhubCliDescription')}</p>
            <CommandBlock command={buildSkillhubInstallCommand(namespace, slug, baseUrl)} />
          </div>
        </details>
      )}
    </div>
  )
}
