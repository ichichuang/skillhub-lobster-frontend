import { expect, test, type FrameLocator, type Page } from '@playwright/test'

const DARK_URL = '/?embed=true&dark=0'
const LIGHT_URL = '/?embed=true&dark=1'
const RETIRED_URL = '/?embed=true&theme=dark&color=%23ff0000&bg=%23000000&surface=%23111111'

async function mountParentHarness(page: Page, childUrl: string): Promise<FrameLocator> {
  const absoluteChildUrl = new URL(childUrl, 'http://127.0.0.1:3000').href
  await page.setContent(`<iframe title="技能中心子页面" src="${absoluteChildUrl}" style="width:1200px;height:900px"></iframe>`)
  const frame = page.frameLocator('iframe[title="技能中心子页面"]')
  await expect(frame.locator('#root')).toBeAttached()
  return frame
}

async function readTheme(frame: FrameLocator) {
  return frame.locator('html').evaluate((root) => {
    const probe = document.createElement('div')
    probe.innerHTML = [
      '<div data-probe="page" class="bg-background"></div>',
      '<div data-probe="card" class="bg-card"></div>',
      '<div data-probe="input" class="bg-input"></div>',
      '<div data-probe="popover" class="bg-popover"></div>',
      '<button data-probe="primary" class="bg-primary text-primary-foreground"></button>',
      '<div data-probe="border" class="border border-border"></div>',
      '<div data-probe="divider" class="bg-divider"></div>',
      '<div data-probe="text" class="text-foreground"></div>',
      '<div data-probe="dialog" class="shadow-dialog"></div>',
      '<div data-probe="card-shadow" class="shadow-card"></div>',
    ].join('')
    document.body.appendChild(probe)
    const style = getComputedStyle(root)
    const valueOf = (name: string, property = 'background-color') => {
      const element = probe.querySelector<HTMLElement>(`[data-probe="${name}"]`)
      return element ? getComputedStyle(element).getPropertyValue(property) : ''
    }
    const result = {
      mode: style.colorScheme,
      isDark: root.classList.contains('dark'),
      primaryAnchor: style.getPropertyValue('--theme-primary-anchor').trim(),
      pageAnchor: style.getPropertyValue('--theme-page-anchor').trim(),
      surfaceAnchor: style.getPropertyValue('--theme-surface-anchor').trim(),
      page: valueOf('page'),
      card: valueOf('card'),
      input: valueOf('input'),
      popover: valueOf('popover'),
      primary: valueOf('primary'),
      primaryForeground: valueOf('primary', 'color'),
      border: valueOf('border', 'border-top-color'),
      divider: valueOf('divider'),
      text: valueOf('text', 'color'),
      hover: style.getPropertyValue('--surface-hover').trim(),
      active: style.getPropertyValue('--surface-active').trim(),
      dialogShadow: valueOf('dialog', 'box-shadow'),
      cardShadow: valueOf('card-shadow', 'box-shadow'),
      selection: style.getPropertyValue('--selection').trim(),
      inlineThemeVariables: Array.from(
        { length: root.style.length },
        (_, index) => root.style.item(index),
      ).filter((property) => property.startsWith('--')),
    }
    probe.remove()
    return result
  })
}

test.describe('parent-owned URL theme integration', () => {
  test('renders canonical dark anchors and semantic surfaces inside a real iframe', async ({ page }) => {
    const frame = await mountParentHarness(page, DARK_URL)

    await expect.poll(() => readTheme(frame)).toMatchObject({
      mode: 'dark',
      isDark: true,
      primaryAnchor: '#57b5cb',
      pageAnchor: '#0c1526',
      surfaceAnchor: '#131d2d',
      page: 'rgb(12, 21, 38)',
      card: 'rgb(19, 29, 45)',
      primary: 'rgb(87, 181, 203)',
      primaryForeground: 'rgb(12, 21, 38)',
      inlineThemeVariables: [],
    })

    const theme = await readTheme(frame)
    expect(theme.border).not.toBe(theme.card)
    expect(theme.divider).not.toBe(theme.page)
    expect(theme.text).not.toBe(theme.card)
    expect(theme.hover).not.toBe(theme.card)
    expect(theme.active).not.toBe(theme.hover)
    expect(theme.dialogShadow).not.toBe('none')
    expect(theme.cardShadow).not.toBe('none')
    expect(theme.selection).not.toBe('')
  })

  test('retains parent params across child navigation and syncs by iframe reload', async ({ page }) => {
    const frame = await mountParentHarness(page, DARK_URL)
    const searchLink = frame.locator('a[href*="/search"]').first()
    await expect(searchLink).toBeVisible()
    await searchLink.click()

    await expect.poll(async () => frame.locator('html').evaluate(() => window.location.search)).toContain('embed=true')
    await expect.poll(async () => frame.locator('html').evaluate(() => window.location.search)).toContain('dark=0')

    await frame.locator('html').evaluate(() => window.location.reload())
    await expect.poll(() => readTheme(frame)).toMatchObject({
      mode: 'dark',
      pageAnchor: '#0c1526',
      surfaceAnchor: '#131d2d',
      inlineThemeVariables: [],
    })

    await page.locator('iframe[title="技能中心子页面"]').evaluate((iframe, src) => {
      const childFrame = iframe as HTMLIFrameElement
      childFrame.src = new URL(src, 'http://127.0.0.1:3000').href
    }, LIGHT_URL)

    await expect.poll(() => readTheme(frame)).toMatchObject({
      mode: 'light',
      isDark: false,
      primaryAnchor: '#57b5cb',
      pageAnchor: '#f6f6f6',
      surfaceAnchor: '#ffffff',
      page: 'rgb(246, 246, 246)',
      card: 'rgb(255, 255, 255)',
      primary: 'rgb(87, 181, 203)',
      primaryForeground: 'rgb(12, 21, 38)',
      inlineThemeVariables: [],
    })
  })

  test('ignores retired theme anchors and stops propagating them on navigation', async ({ page }) => {
    const frame = await mountParentHarness(page, RETIRED_URL)

    await expect.poll(() => readTheme(frame)).toMatchObject({
      mode: 'light',
      isDark: false,
      primaryAnchor: '#57b5cb',
      pageAnchor: '#f6f6f6',
      surfaceAnchor: '#ffffff',
      page: 'rgb(246, 246, 246)',
      card: 'rgb(255, 255, 255)',
      primary: 'rgb(87, 181, 203)',
      primaryForeground: 'rgb(12, 21, 38)',
      inlineThemeVariables: [],
    })

    await frame.locator('a[href*="/search"]').first().click()
    await expect.poll(
      async () => frame.locator('html').evaluate(() => window.location.search),
    ).not.toContain('theme=')
    await expect.poll(async () => frame.locator('html').evaluate(() => window.location.search)).not.toContain('color=')
    await expect.poll(async () => frame.locator('html').evaluate(() => window.location.search)).not.toContain('bg=')
    await expect.poll(async () => frame.locator('html').evaluate(() => window.location.search)).not.toContain('surface=')
  })
})
