import { spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url))
const gatePath = path.join(scriptsDirectory, 'check-theme-contract.mjs')

function createFixedThemeFixture() {
  return new Map([
    ['src/pages/example.tsx', [
      "const theme = { color: 'semantic', surface: 'documentation' }",
      "export const Example = () => <div className=\"bg-background text-foreground\">{theme.color}</div>",
    ].join('\n')],
    ['src/shared/lib/url-theme.ts', [
      "export function parseParentUrlTheme(search: string) {",
      "  const values = new URLSearchParams(search).getAll('dark')",
      "  return values.length === 1 && (values[0] === '0' || values[0] === '1') ? { dark: values[0] } : {}",
      '}',
      "export function resolveParentThemeMode(theme: { dark?: string }) { return theme.dark === '0' ? 'dark' : 'light' }",
      "export function applyThemeMode(mode: string, root: HTMLElement) { root.classList.toggle('dark', mode === 'dark'); root.style.colorScheme = mode }",
    ].join('\n')],
    ['src/bootstrap.ts', [
      "import { applyThemeMode, parseParentUrlTheme, resolveParentThemeMode } from './shared/lib/url-theme'",
      'const parentTheme = parseParentUrlTheme(window.location.search)',
      'applyThemeMode(resolveParentThemeMode(parentTheme))',
    ].join('\n')],
    ['src/app/router.tsx', [
      "export const ROOT_RETAINED_SEARCH_KEYS = ['embed', 'dark'] as const",
      'retainSearchParams<RootSearch>([...ROOT_RETAINED_SEARCH_KEYS])',
    ].join('\n')],
    ['index.html', [
      '<script>',
      '  const params = new URLSearchParams(window.location.search)',
      "  const darkValues = params.getAll('dark')",
      "  const isDark = darkValues.length === 1 && darkValues[0] === '0'",
      '  const root = document.documentElement',
      "  root.classList.toggle('dark', isDark)",
      "  root.style.colorScheme = isDark ? 'dark' : 'light'",
      '</script>',
    ].join('\n')],
    ['src/index.css', [
      ':root { --background: 0 0% 100%; --card: 0 0% 100%; --primary: 190 50% 50%; }',
      '.dark { --background: 220 50% 10%; --card: 220 40% 15%; --primary: 190 50% 50%; }',
    ].join('\n')],
  ])
}

async function runGate(mutator = () => {}) {
  const fixtureRoot = await mkdtemp(path.join(tmpdir(), 'skillhub-theme-gate-'))
  try {
    const files = createFixedThemeFixture()
    mutator(files)

    for (const [relativePath, source] of files) {
      const target = path.join(fixtureRoot, relativePath)
      await mkdir(path.dirname(target), { recursive: true })
      await writeFile(target, source)
    }

    const gateSource = await readFile(gatePath, 'utf8')
    const isolatedGateSource = gateSource.replace(
      /const projectRoot = [^\n]+/,
      `const projectRoot = ${JSON.stringify(fixtureRoot)}`,
    )
    const isolatedGatePath = path.join(fixtureRoot, 'check-theme-contract.mjs')
    await writeFile(isolatedGatePath, isolatedGateSource)

    const result = spawnSync(process.execPath, [isolatedGatePath], { encoding: 'utf8' })
    return {
      status: result.status,
      output: `${result.stdout}${result.stderr}`,
    }
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true })
  }
}

describe('fixed dual-theme contract gate', () => {
  it('accepts the current fixed runtime', async () => {
    const result = await runGate()

    expect(result.status, result.output).toBe(0)
    expect(result.output).toContain('Theme contract passed')
  })

  it('rejects reintroducing the retired dynamic CSS theme adapter', async () => {
    const result = await runGate((files) => {
      files.set('src/shared/theme/css-theme-adapter.ts', [
        'export function applySemanticTheme(root: HTMLElement) {',
        "  root.style.setProperty('--background', '#ffffff')",
        "  root.classList.toggle('dark', false)",
        '}',
      ].join('\n'))
    })

    expect(result.status).not.toBe(0)
    expect(result.output).toContain('CSS variable writer outside fixed palette owner')
    expect(result.output).toContain('dark-mode writer outside fixed mode owner')
  })

  it.each(['theme', 'color', 'bg', 'surface'])(
    'rejects active URL reads of retired %s',
    async (key) => {
      const result = await runGate((files) => {
        files.set(
          'src/shared/lib/url-theme.ts',
          `${files.get('src/shared/lib/url-theme.ts')}\nnew URLSearchParams(location.search).get('${key}')`,
        )
      })

      expect(result.status).not.toBe(0)
      expect(result.output).toContain(`active URL theme protocol reads retired key: ${key}`)
    },
  )

  it('rejects retaining an old theme parameter in Router', async () => {
    const result = await runGate((files) => {
      files.set(
        'src/app/router.tsx',
        files.get('src/app/router.tsx').replace("['embed', 'dark']", "['embed', 'dark', 'theme']"),
      )
    })

    expect(result.status).not.toBe(0)
    expect(result.output).toContain('router global retention must be exactly: embed, dark')
  })

  it('rejects semantic palette writes in prepaint', async () => {
    const result = await runGate((files) => {
      files.set(
        'index.html',
        files.get('index.html').replace(
          '</script>',
          "root.style.setProperty('--background', '0 0% 0%')\n</script>",
        ),
      )
    })

    expect(result.status).not.toBe(0)
    expect(result.output).toContain('index.html prepaint must not write semantic palette CSS variables')
  })

  it('rejects dynamic palette derivation or adapter calls in bootstrap', async () => {
    const result = await runGate((files) => {
      files.set(
        'src/bootstrap.ts',
        `${files.get('src/bootstrap.ts')}\nderiveSemanticTheme({})\napplySemanticTheme({})`,
      )
    })

    expect(result.status).not.toBe(0)
    expect(result.output).toContain('bootstrap.ts must not invoke dynamic theme API: deriveSemanticTheme')
    expect(result.output).toContain('bootstrap.ts must not invoke dynamic theme API: applySemanticTheme')
  })

  it('keeps structural palette utilities and inline colors blocked in product code', async () => {
    const result = await runGate((files) => {
      files.set(
        'src/pages/example.tsx',
        'export const Example = () => <div className="bg-white text-gray-500" style={{ color: "#ffffff" }} />',
      )
    })

    expect(result.status).not.toBe(0)
    expect(result.output).toContain('direct palette utility: bg-white')
    expect(result.output).toContain('direct palette utility: text-gray-500')
    expect(result.output).toContain('raw color: #ffffff')
  })
})
