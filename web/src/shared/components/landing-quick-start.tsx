import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bot, Check, Copy, Search, UserRound } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useCopyToClipboard } from '@/shared/lib/clipboard'
import { resolvePublicRegistryUrl } from '@/shared/lib/registry-url'

type LandingQuickStartTabId = 'agent' | 'human'

interface LandingQuickStartTab {
  id: LandingQuickStartTabId
  label: string
  description: string
  command: string
}

interface LandingQuickStartSectionProps {
  onSearch: (query: string) => void
}

const tabIcons: Record<LandingQuickStartTabId, LucideIcon> = {
  agent: Bot,
  human: UserRound,
}

function getAppBaseUrl(): string {
  if (typeof window === 'undefined') {
    return ''
  }

  const runtimeConfig = window.__SKILLHUB_RUNTIME_CONFIG__
  return resolvePublicRegistryUrl(
    runtimeConfig?.appBaseUrl,
    `${window.location.protocol}//${window.location.host}`,
  )
}

function CompactCopyButton({ text }: { text: string }) {
  const { t } = useTranslation()
  const [copied, copy] = useCopyToClipboard()

  const handleCopy = async () => {
    try {
      await copy(text)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const label = copied ? (t('copyButton.copied') || '已复制') : (t('copyButton.copy') || '复制')

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={label}
      title={label}
      className="absolute right-2.5 top-1/2 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-xl border bg-card transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </button>
  )
}

export function LandingQuickStartSection({ onSearch }: LandingQuickStartSectionProps) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<LandingQuickStartTabId>('agent')
  const baseUrl = useMemo(() => getAppBaseUrl(), [])

  const tabs: LandingQuickStartTab[] = [
    {
      id: 'agent',
      label: t('landing.quickStart.tabs.agent'),
      description: t('landing.quickStart.agent.description'),
      command: t('landing.quickStart.agent.commandTemplate', {
        defaultValue: t('landing.quickStart.agent.command'),
        baseUrl,
        guideUrl: `${baseUrl}/registry/skill.md`,
      }),
    },
    {
      id: 'human',
      label: t('landing.quickStart.tabs.human'),
      description: t('landing.quickStart.human.description'),
      command: t('landing.quickStart.human.commandTemplate', {
        defaultValue: t('landing.quickStart.human.command'),
        url: baseUrl,
      }),
    },
  ]

  const currentTab = tabs.find((tab) => tab.id === activeTab) ?? tabs[0]

  return (
    <section className="rounded-[32px] border border-border bg-card p-4 shadow-dialog md:p-5">
      <div className="mb-4 px-2 pt-2">
        <h3 className="text-2xl font-semibold tracking-tight">{t('landing.quickStart.title')}</h3>
        <p className="mt-2 text-sm leading-6 md:text-base" style={{ color: 'hsl(var(--text-secondary))' }}>
          {t('landing.quickStart.description')}
        </p>
      </div>

      <div className="mb-4 flex items-center rounded-2xl border border-border bg-input px-5 py-3.5 shadow-card">
        <Search className="mr-3 h-5 w-5 flex-shrink-0 text-muted-foreground" strokeWidth={1.5} />
        <input
          type="search"
          aria-label={t('landing.quickStart.searchLabel')}
          placeholder={t('landing.hero.searchPlaceholder')}
          className="hero-input min-w-0 flex-1 bg-transparent text-base text-foreground outline-none"
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              onSearch(event.currentTarget.value)
            }
          }}
        />
      </div>

      <div className="mx-auto max-w-2xl rounded-[28px] border border-border bg-card p-3 shadow-popover">
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-muted/70 p-1.5">
          {tabs.map((tab) => {
            const isActive = tab.id === currentTab.id
            const Icon = tabIcons[tab.id]

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                aria-pressed={isActive}
                className={`flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-[14px] px-4 py-3 text-base font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                  isActive
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-card/50 hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" strokeWidth={1.75} />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        <div className="px-1 pb-4 pt-8 md:pb-6 md:pt-9">
          <p className="mx-auto mb-6 max-w-xl text-center text-base font-medium leading-relaxed md:text-lg">
            {currentTab.description}
          </p>
          <div className="relative h-[64px] rounded-2xl border bg-muted/70 px-4 py-3 pr-14 shadow-inner md:h-[68px]">
            <code
              className={`flex h-full items-center overflow-hidden whitespace-normal break-all pr-1 font-mono text-[11px] leading-5 tracking-[-0.02em] md:text-xs ${
                currentTab.id === 'agent' ? 'text-primary' : 'text-foreground'
              }`}
            >
              {currentTab.command}
            </code>
            <CompactCopyButton text={currentTab.command} />
          </div>
        </div>
      </div>
    </section>
  )
}
