import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import '@/i18n/config'
import { LandingQuickStartSection } from './landing-quick-start'

describe('LandingQuickStartSection agent prompt', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders a self-contained terminal instruction from the runtime public base URL', () => {
    vi.stubGlobal('window', {
      __SKILLHUB_RUNTIME_CONFIG__: {
        appBaseUrl: 'http://10.100.5.133/skillhub',
      },
      location: {
        protocol: 'http:',
        host: '10.100.5.133',
      },
    })

    const html = renderToStaticMarkup(<LandingQuickStartSection onSearch={() => undefined} />)

    expect(html).toContain('terminal/Exec')
    expect(html).toContain('web-fetch')
    expect(html).toContain('http://10.100.5.133/skillhub')
    expect(html).toContain('curl http://10.100.5.133/skillhub/registry/skill.md')
    expect(html).toContain('npx clawhub')
    expect(html).toContain('--registry http://10.100.5.133/skillhub')
  })
})
