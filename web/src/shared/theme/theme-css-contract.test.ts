// @ts-expect-error Vitest runs in Node; the production tsconfig intentionally omits Node globals.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import tailwindConfig from '../../../tailwind.config'

const css = readFileSync(new URL('../../index.css', import.meta.url), 'utf8')

const FROZEN_LIGHT_PALETTE = {
  '--theme-primary-anchor': '#57b5cb',
  '--theme-page-anchor': '#f6f6f6',
  '--theme-surface-anchor': '#ffffff',
  '--background': '0 0% 96.4706%',
  '--foreground': '220.7143 37.8378% 14.5098%',
  '--card': '0 0% 100%',
  '--card-foreground': '220.7143 37.8378% 14.5098%',
  '--popover': '219.8698 8.2716% 96.1512%',
  '--popover-foreground': '220.7143 37.8378% 14.5098%',
  '--primary': '191.3793 52.7273% 56.8627%',
  '--primary-foreground': '219.2308 52% 9.8039%',
  '--secondary': '43.8136 0.0005% 98.4088%',
  '--secondary-foreground': '220.7143 37.8378% 14.5098%',
  '--muted': '43.8136 0.0005% 98.4088%',
  '--muted-foreground': '219.9798 8.2152% 47.9765%',
  '--accent': '192.5465 50.8861% 96.7295%',
  '--accent-foreground': '220.7143 37.8378% 14.5098%',
  '--destructive': '0 72.2222% 50.5882%',
  '--destructive-foreground': '0 0% 100%',
  '--border': '219.875 8.2123% 90.4314%',
  '--input': '43.8136 0.0008% 99.1154%',
  '--ring': '191.3793 52.7273% 56.8627%',
  '--surface-raised': '219.8698 8.2716% 96.1512%',
  '--surface-muted': '43.8136 0.0005% 98.4088%',
  '--surface-hover': '192.5465 50.8861% 96.7295%',
  '--surface-active': '192.5314 50.8702% 94.273%',
  '--divider': '219.8715 8.2522% 94.2374%',
  '--border-strong': '219.88 8.1601% 85.7154%',
  '--primary-hover': '192.106 44.7427% 52.7138%',
  '--primary-active': '192.7096 40.255% 49.6388%',
  '--primary-subtle': '192.5418 50.8801% 95.9111%',
  '--selection': '192.5257 50.8665% 93.4533%',
  '--text-secondary': '220.023 10.4936% 41.443%',
  '--text-muted': '219.9798 8.2152% 47.9765%',
  '--text-placeholder': '219.9827 8.3752% 47.4587%',
  '--border-card': '219.875 8.2123% 90.4314%',
  '--success': '142.1277 76.2162% 36.2745%',
  '--success-surface': '127.4569 37.9201% 95.506%',
  '--warning': '32.1327 94.6188% 43.7255%',
  '--warning-surface': '25.0707 79.693% 96.3069%',
  '--danger': '0 72.2222% 50.5882%',
  '--danger-surface': '7.6888 100% 96.5774%',
  '--info': '200.4061 98.01% 39.4118%',
  '--info-surface': '206.8001 62.9976% 95.889%',
  '--shadow-card': '0 1px 2px rgb(12 21 38 / 0.04), 0 8px 24px rgb(12 21 38 / 0.08)',
  '--shadow-popover': '0 12px 32px rgb(12 21 38 / 0.12)',
  '--shadow-dialog': '0 24px 64px rgb(12 21 38 / 0.16)',
  '--brand-start': '#57b5cb',
  '--brand-end': '#57b5cb',
  '--brand-gradient': 'linear-gradient(135deg, var(--brand-start) 0%, var(--brand-end) 100%)',
  '--bg-page': 'hsl(0 0% 96.4706%)',
} as const

const FROZEN_DARK_PALETTE = {
  '--theme-primary-anchor': '#57b5cb',
  '--theme-page-anchor': '#0c1526',
  '--theme-surface-anchor': '#131d2d',
  '--background': '219.2308 52% 9.8039%',
  '--foreground': '210 40% 98.0392%',
  '--card': '216.9231 40.625% 12.549%',
  '--card-foreground': '210 40% 98.0392%',
  '--popover': '216.8431 32.9391% 15.3776%',
  '--popover-foreground': '210 40% 98.0392%',
  '--primary': '191.3793 52.7273% 56.8627%',
  '--primary-foreground': '219.2308 52% 9.8039%',
  '--secondary': '217.947 45.1633% 11.3027%',
  '--secondary-foreground': '210 40% 98.0392%',
  '--muted': '217.947 45.1633% 11.3027%',
  '--muted-foreground': '216.0311 7.6076% 53.7597%',
  '--accent': '211.3626 39.6709% 15.7413%',
  '--accent-foreground': '210 40% 98.0392%',
  '--destructive': '0 72.2222% 50.5882%',
  '--destructive-foreground': '0 0% 100%',
  '--border': '216.7407 25.215% 19.7466%',
  '--input': '217.4902 43.0468% 11.8545%',
  '--ring': '191.3793 52.7273% 56.8627%',
  '--surface-raised': '216.8431 32.9391% 15.3776%',
  '--surface-muted': '217.947 45.1633% 11.3027%',
  '--surface-hover': '211.3626 39.6709% 15.7413%',
  '--surface-active': '208.1564 39.2989% 18.1833%',
  '--divider': '216.807 29.9761% 16.8175%',
  '--border-strong': '216.6652 20.7576% 23.4956%',
  '--primary-hover': '192.106 44.7427% 52.7138%',
  '--primary-active': '192.7096 40.255% 49.6388%',
  '--primary-subtle': '208.1564 39.2989% 18.1833%',
  '--selection': '207.2254 39.2161% 19.0061%',
  '--text-secondary': '215.6169 8.2366% 65.2663%',
  '--text-muted': '216.0311 7.6076% 53.7597%',
  '--text-placeholder': '216.0801 7.5287% 52.0143%',
  '--border-card': '216.7407 25.215% 19.7466%',
  '--success': '142.1277 76.2162% 36.2745%',
  '--success-surface': '187.226 38.5045% 14.7858%',
  '--warning': '32.1327 94.6188% 43.7255%',
  '--warning-surface': '286.3649 5.4879% 18.269%',
  '--danger': '0 72.2222% 50.5882%',
  '--danger-surface': '311.9933 15.8589% 17.2296%',
  '--info': '200.4061 98.01% 39.4118%',
  '--info-surface': '211.3431 49.3048% 17.5702%',
  '--shadow-card': '0 8px 24px rgb(0 0 0 / 0.14)',
  '--shadow-popover': '0 14px 36px rgb(0 0 0 / 0.2)',
  '--shadow-dialog': '0 24px 64px rgb(0 0 0 / 0.28)',
  '--brand-start': '#57b5cb',
  '--brand-end': '#57b5cb',
  '--brand-gradient': 'linear-gradient(135deg, var(--brand-start) 0%, var(--brand-end) 100%)',
  '--bg-page': 'hsl(219.2308 52% 9.8039%)',
} as const

const FROZEN_CSS_ALIASES = {
  '--surface-glass': 'var(--surface-raised)',
  '--glow-primary': 'var(--primary)',
  '--glow-accent': 'var(--primary)',
} as const

function readExplicitVariables(selector: ':root' | '.dark'): Record<string, string> {
  const escapedSelector = selector.replace('.', '\\.')
  const block = css.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\n  \\}`))?.[1]
  if (!block) throw new Error(`Missing ${selector} theme block`)

  return Object.fromEntries(
    [...block.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((match) => [match[1], match[2].trim()]),
  )
}

function selectFrozenVariables(
  declarations: Readonly<Record<string, string>>,
  palette: Readonly<Record<string, string>>,
): Record<string, string | undefined> {
  return Object.fromEntries(Object.keys(palette).map((name) => [name, declarations[name]]))
}

describe('theme CSS contract', () => {
  it('freezes the complete canonical Light runtime palette explicitly in :root', () => {
    const frozenCssPalette = { ...FROZEN_LIGHT_PALETTE, ...FROZEN_CSS_ALIASES }

    expect(selectFrozenVariables(readExplicitVariables(':root'), frozenCssPalette))
      .toEqual(frozenCssPalette)
  })

  it('freezes the complete canonical Dark runtime palette explicitly in .dark', () => {
    const frozenCssPalette = { ...FROZEN_DARK_PALETTE, ...FROZEN_CSS_ALIASES }

    expect(selectFrozenVariables(readExplicitVariables('.dark'), frozenCssPalette))
      .toEqual(frozenCssPalette)
  })

  it('does not preserve the retired indigo-violet structural palette', () => {
    expect(css.toLowerCase()).not.toContain('#6a6dff')
    expect(css.toLowerCase()).not.toContain('#b85eff')
    expect(css).not.toContain('rgba(106, 109, 255')
  })

  it('styles reusable status UI through semantic variables', () => {
    expect(css).toContain('background: hsl(var(--success-surface))')
    expect(css).toContain('background: hsl(var(--warning-surface))')
    expect(css).toContain('background: hsl(var(--danger-surface))')
    expect(css).toContain('background: hsl(var(--info-surface))')
  })

  it('exposes frozen semantic colors and elevations to Tailwind', () => {
    const extend = tailwindConfig.theme?.extend as {
      colors?: Record<string, unknown>
      boxShadow?: Record<string, unknown>
    }

    expect(extend.colors).toMatchObject({
      surface: expect.any(Object),
      success: expect.any(Object),
      warning: expect.any(Object),
      danger: expect.any(Object),
      info: expect.any(Object),
    })
    expect(extend.boxShadow).toMatchObject({
      card: 'var(--shadow-card)',
      popover: 'var(--shadow-popover)',
      dialog: 'var(--shadow-dialog)',
    })
  })
})
