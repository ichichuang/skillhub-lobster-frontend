import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  InstallCommand,
  buildInstallCommand,
  buildInstallTarget,
  buildSkillhubInstallCommand,
  getBaseUrl,
} from './install-command'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: unknown }) => children,
}))

describe('install-command', () => {
  const originalWindow = globalThis.window

  function setMockWindow(appBaseUrl?: string) {
    const location = {
      protocol: 'https:',
      host: 'fallback.example.com',
    } satisfies Pick<Location, 'protocol' | 'host'>

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      writable: true,
      value: {
        __SKILLHUB_RUNTIME_CONFIG__: {
          appBaseUrl,
        },
        location,
      } satisfies {
        location: Pick<Location, 'protocol' | 'host'>
      } & {
        __SKILLHUB_RUNTIME_CONFIG__: {
          appBaseUrl?: string
        }
      },
    })
  }

  afterEach(() => {
    if (originalWindow) {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        writable: true,
        value: originalWindow,
      })
      return
    }
    Reflect.deleteProperty(globalThis, 'window')
  })

  it('uses the plain slug for the global namespace', () => {
    expect(buildInstallTarget('global', 'my-skill')).toBe('my-skill')
    expect(buildInstallCommand('global', 'my-skill', 'https://skill.xfyun.cn')).toBe(
      'npx clawhub install my-skill --registry https://skill.xfyun.cn',
    )
  })

  it('prefixes non-global namespaces in the install target', () => {
    expect(buildInstallTarget('team-alpha', 'my-skill')).toBe('team-alpha--my-skill')
    expect(buildInstallCommand('team-alpha', 'my-skill', 'https://skill.xfyun.cn')).toBe(
      'npx clawhub install team-alpha--my-skill --registry https://skill.xfyun.cn',
    )
  })

  it('builds a one-line SkillHub npx command for the global namespace', () => {
    expect(buildSkillhubInstallCommand('global', 'my-skill', 'https://skill.xfyun.cn')).toBe(
      'npx @astron-team/skillhub@latest install my-skill --registry https://skill.xfyun.cn',
    )
  })

  it('builds a one-line SkillHub npx command with namespace for team skills', () => {
    expect(buildSkillhubInstallCommand('team-alpha', 'my-skill', 'https://skill.xfyun.cn')).toBe(
      'npx @astron-team/skillhub@latest install my-skill --namespace team-alpha --registry https://skill.xfyun.cn',
    )
  })

  it('uses the runtime app base url when available', () => {
    setMockWindow('https://app.example.com')

    expect(getBaseUrl()).toBe('https://app.example.com')
  })

  it('falls back to the browser origin when the app base url is missing', () => {
    setMockWindow()
    expect(getBaseUrl()).toBe('https://fallback.example.com')
  })

  it('falls back to browser origin when app base url is localhost', () => {
    setMockWindow('http://localhost')
    expect(getBaseUrl()).toBe('https://fallback.example.com')
  })

  it('falls back to browser origin when app base url contains localhost', () => {
    setMockWindow('http://localhost:8080')
    expect(getBaseUrl()).toBe('https://fallback.example.com')
  })

  it('renders the install command in a more compact code block', () => {
    setMockWindow('http://localhost:3000')

    const html = renderToStaticMarkup(createElement(InstallCommand, {
      namespace: 'global',
      slug: 'meeting-minutes-generator',
      visibility: 'PUBLIC',
      publishedVersion: '1.0.0',
    }))

    expect(html).toContain('px-4 py-3')
    expect(html).toContain('leading-relaxed')
    expect(html).toContain('break-all')
  })

  it('offers the secondary CLI under the anonymous-install alternatives', () => {
    setMockWindow('https://app.example.com')

    const html = renderToStaticMarkup(createElement(InstallCommand, {
      namespace: 'global',
      slug: 'meeting-minutes-generator',
      visibility: 'PUBLIC',
      publishedVersion: '1.0.0',
    }))

    expect(html).toContain('skillDetail.installGuide.otherMethods')
    expect(html).toContain('npx clawhub install meeting-minutes-generator --registry https://app.example.com')
    expect(html).toContain('npx @astron-team/skillhub@latest install meeting-minutes-generator --registry https://app.example.com')
  })

  it('renders login then ClawHub install for authenticated skills', () => {
    setMockWindow('https://app.example.com')

    const html = renderToStaticMarkup(createElement(InstallCommand, {
      namespace: 'team-alpha',
      slug: 'meeting-minutes-generator',
      visibility: 'PRIVATE',
      publishedVersion: '1.0.0',
    }))

    expect(html).toContain('skillDetail.installGuide.loginStep')
    expect(html).toContain('npx clawhub --site https://app.example.com --registry https://app.example.com login')
    expect(html).toContain('npx clawhub install team-alpha--meeting-minutes-generator --registry https://app.example.com')
    expect(html).not.toContain('npx @astron-team/skillhub@latest install meeting-minutes-generator --namespace team-alpha --registry https://app.example.com')
  })
})
