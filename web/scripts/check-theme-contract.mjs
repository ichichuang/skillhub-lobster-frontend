import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceRoot = path.join(projectRoot, 'src')
const paletteUtilityPattern = /(?:bg|text|border|ring|from|via|to)-(?:white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-[0-9]+)?(?:\/[0-9.]+)?/g
const rawColorPattern = /#[0-9A-Fa-f]{6}|rgba?\(/g
const sourceExceptions = new Map([
  ['shared/components/quick-start.tsx', 'terminal chrome and syntax highlighting'],
  ['shared/ui/dialog.tsx', 'modal scrim'],
  ['features/skill/code-renderer.tsx', 'escaped source rendering'],
])
const themeModeWriterFiles = new Set(['shared/lib/url-theme.ts'])
const retiredUrlThemeKeys = ['theme', 'color', 'bg', 'surface']
const dynamicThemeRuntimeApis = [
  'resolveParentThemeAnchors',
  'deriveSemanticTheme',
  'semanticThemeToCssVariables',
  'applySemanticTheme',
  'mixOklab',
  'rgbToHslChannels',
]

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await collectFiles(target))
    else if (entry.isFile()) files.push(target)
  }
  return files
}

function getException(relativePath) {
  for (const [target, reason] of sourceExceptions) {
    if (target.endsWith('/') ? relativePath.startsWith(target) : relativePath === target) return reason
  }
  return undefined
}

function lineNumberAt(source, index) {
  return source.slice(0, index).split('\n').length
}

function collectPatternViolations(source, pattern, relativePath, label) {
  return [...source.matchAll(pattern)].map((match) => (
    `${relativePath}:${lineNumberAt(source, match.index ?? 0)} ${label}: ${match[0]}`
  ))
}

function readsRetiredUrlKey(source, key) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const likelySearchObject = '(?:search|query|params|values|parentTheme)'
  return [
    new RegExp(`(?:get|getAll|has)\\s*\\(\\s*['"]${escapedKey}['"]`),
    new RegExp(`\\b${likelySearchObject}\\s*\\.\\s*${escapedKey}\\b`),
    new RegExp(`\\b${likelySearchObject}\\s*\\[\\s*['"]${escapedKey}['"]\\s*\\]`),
    new RegExp(`\\{[^}\\n]*\\b${escapedKey}\\b[^}\\n]*\\}\\s*=\\s*${likelySearchObject}\\b`),
  ].some((pattern) => pattern.test(source))
}

function collectRetiredUrlViolations(activeRuntimeSources) {
  const violations = []
  for (const [relativePath, source] of activeRuntimeSources) {
    for (const key of retiredUrlThemeKeys) {
      if (readsRetiredUrlKey(source, key)) {
        violations.push(`${relativePath} active URL theme protocol reads retired key: ${key}`)
      }
    }
  }
  return violations
}

function parseRetainedSearchKeys(routerSource) {
  const declaration = routerSource.match(/ROOT_RETAINED_SEARCH_KEYS\s*=\s*\[([\s\S]*?)\]\s*as const/)
  if (!declaration) return undefined
  return [...declaration[1].matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1])
}

function collectRouterViolations(routerSource) {
  const violations = []
  const retainedKeys = parseRetainedSearchKeys(routerSource)
  if (!retainedKeys || retainedKeys.join(',') !== 'embed,dark') {
    violations.push('router global retention must be exactly: embed, dark')
  }
  if (!/retainSearchParams[\s\S]{0,240}ROOT_RETAINED_SEARCH_KEYS/.test(routerSource)) {
    violations.push('router must apply ROOT_RETAINED_SEARCH_KEYS through retainSearchParams')
  }
  return violations
}

function collectPrepaintViolations(indexSource) {
  const violations = []
  if (!/getAll\(\s*['"]dark['"]\s*\)/.test(indexSource)) {
    violations.push('index.html prepaint must read dark with duplicate-safe getAll')
  }
  if (!/classList\.(?:add|remove|toggle)\(\s*['"]dark['"]/.test(indexSource)) {
    violations.push('index.html prepaint must apply the root .dark class')
  }
  if (!/style\.colorScheme\s*=/.test(indexSource)) {
    violations.push('index.html prepaint must apply color-scheme')
  }
  if (
    /style\.setProperty\(\s*['"]--/.test(indexSource)
    || /style\.(?:backgroundColor|color)\s*=/.test(indexSource)
    || /--theme-(?:primary|page|surface)-anchor/.test(indexSource)
  ) {
    violations.push('index.html prepaint must not write semantic palette CSS variables')
  }
  for (const api of dynamicThemeRuntimeApis) {
    if (new RegExp(`\\b${api}\\b`).test(indexSource)) {
      violations.push(`index.html prepaint must not invoke dynamic theme API: ${api}`)
    }
  }
  return violations
}

function collectBootstrapViolations(bootstrapSource) {
  const violations = []
  for (const requiredStage of ['parseParentUrlTheme', 'resolveParentThemeMode', 'applyThemeMode']) {
    if (!bootstrapSource.includes(requiredStage)) {
      violations.push(`bootstrap.ts is missing fixed theme-mode stage: ${requiredStage}`)
    }
  }
  for (const api of dynamicThemeRuntimeApis) {
    if (new RegExp(`\\b${api}\\b`).test(bootstrapSource)) {
      violations.push(`bootstrap.ts must not invoke dynamic theme API: ${api}`)
    }
  }
  if (/shared\/theme\/(?:color-math|derive-semantic-theme|css-theme-adapter)/.test(bootstrapSource)) {
    violations.push('bootstrap.ts must not import dynamic theme implementation files')
  }
  if (/style\.setProperty\(\s*['"]--/.test(bootstrapSource)) {
    violations.push('bootstrap.ts must not write semantic palette CSS variables')
  }
  return violations
}

function readCssBlock(cssSource, selector) {
  const escapedSelector = selector.replace('.', '\\.')
  return cssSource.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\}`))?.[1]
}

function collectFixedPaletteViolations(cssSource) {
  const violations = []
  for (const selector of [':root', '.dark']) {
    const block = readCssBlock(cssSource, selector)
    if (!block) {
      violations.push(`index.css is missing fixed palette block: ${selector}`)
      continue
    }
    for (const token of ['--background', '--card', '--primary']) {
      if (!block.includes(`${token}:`)) {
        violations.push(`index.css ${selector} palette is missing semantic token: ${token}`)
      }
    }
  }
  return violations
}

async function main() {
  const allFiles = await collectFiles(sourceRoot)
  const sourceFiles = allFiles.filter((file) => /\.(?:ts|tsx)$/.test(file) && !/\.test\./.test(file))
  const violations = []
  let checkedFiles = 0

  for (const file of sourceFiles) {
    const relativePath = path.relative(sourceRoot, file).split(path.sep).join('/')
    if (relativePath.startsWith('api/generated/')) continue
    const source = await readFile(file, 'utf8')
    const exception = getException(relativePath)

    if (!exception) {
      checkedFiles += 1
      violations.push(...collectPatternViolations(source, paletteUtilityPattern, relativePath, 'direct palette utility'))
      violations.push(...collectPatternViolations(source, rawColorPattern, relativePath, 'raw color'))
    } else if (relativePath === 'shared/ui/dialog.tsx') {
      const withoutApprovedScrim = source.replaceAll('bg-black/60', '')
      violations.push(...collectPatternViolations(withoutApprovedScrim, paletteUtilityPattern, relativePath, 'unapproved palette utility'))
      violations.push(...collectPatternViolations(withoutApprovedScrim, rawColorPattern, relativePath, 'unapproved raw color'))
    }

    violations.push(...collectPatternViolations(source, /style\.setProperty\(\s*['"]--/g, relativePath, 'CSS variable writer outside fixed palette owner'))
    if (!themeModeWriterFiles.has(relativePath)) {
      violations.push(...collectPatternViolations(source, /classList\.(?:add|remove|toggle)\(\s*['"]dark['"]/g, relativePath, 'dark-mode writer outside fixed mode owner'))
    }
    violations.push(...collectPatternViolations(source, /prefers-color-scheme|postMessage\s*\(/g, relativePath, 'forbidden runtime theme channel'))
  }

  const indexSource = await readFile(path.join(projectRoot, 'index.html'), 'utf8')
  const bootstrapSource = await readFile(path.join(sourceRoot, 'bootstrap.ts'), 'utf8')
  const routerSource = await readFile(path.join(sourceRoot, 'app/router.tsx'), 'utf8')
  const urlThemeSource = await readFile(path.join(sourceRoot, 'shared/lib/url-theme.ts'), 'utf8')
  const cssSource = await readFile(path.join(sourceRoot, 'index.css'), 'utf8')

  violations.push(...collectRetiredUrlViolations([
    ['shared/lib/url-theme.ts', urlThemeSource],
    ['app/router.tsx', routerSource],
    ['bootstrap.ts', bootstrapSource],
    ['index.html', indexSource],
  ]))
  violations.push(...collectRouterViolations(routerSource))
  violations.push(...collectPrepaintViolations(indexSource))
  violations.push(...collectBootstrapViolations(bootstrapSource))
  violations.push(...collectFixedPaletteViolations(cssSource))

  if (!/getAll\(\s*['"]dark['"]\s*\)/.test(urlThemeSource)) {
    violations.push('url-theme.ts must parse dark with duplicate-safe getAll')
  }
  for (const api of dynamicThemeRuntimeApis) {
    if (new RegExp(`\\b${api}\\b`).test(urlThemeSource)) {
      violations.push(`url-theme.ts must not invoke dynamic theme API: ${api}`)
    }
  }
  for (const retiredColor of ['#6a6dff', '#b85eff', 'rgba(106, 109, 255']) {
    if (cssSource.toLowerCase().includes(retiredColor)) violations.push(`index.css contains retired structural color: ${retiredColor}`)
  }

  if (violations.length > 0) {
    throw new Error(`Theme contract violations:\n${violations.join('\n')}`)
  }

  console.log(`Theme contract passed (${checkedFiles} source files; ${sourceExceptions.size} documented exception routes).`)
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
