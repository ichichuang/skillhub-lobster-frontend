import { lstat, readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import vm from 'node:vm'

const BASE_PATH_PLACEHOLDER = '/__SKILLHUB_WEB_BASE_PATH__/'
const PUBLIC_BASE_URL_PLACEHOLDER = '${SKILLHUB_PUBLIC_BASE_URL}'
const EXPECTED_BASE_PATH = '/skillhub/'
const TEXT_ARTIFACT_EXTENSIONS = new Set(['.css', '.html', '.js'])
const CREDENTIAL_KEY_PATTERN = /(cookie|password|secret|token|username)/i
const LOCAL_FILESYSTEM_PATTERNS = [
  /file:\/\//i,
  /(?:^|[\s"'`=(])\/(?:Users|home|private\/var\/folders|tmp)\//m,
  /[A-Za-z]:\\(?:Users|Documents and Settings)\\/i,
]

function usage() {
  return 'Usage: node scripts/verify-dist-contract.mjs <dist-directory> --resolved'
}

function parseArguments(argumentsList) {
  if (argumentsList.length !== 2 || argumentsList[1] !== '--resolved' || !argumentsList[0]) {
    throw new Error(usage())
  }
  return path.resolve(process.cwd(), argumentsList[0])
}

function isWithin(parent, candidate) {
  const relativePath = path.relative(parent, candidate)
  return relativePath === '' || (!relativePath.startsWith(`..${path.sep}`) && relativePath !== '..' && !path.isAbsolute(relativePath))
}

async function collectFiles(directory, relativeDirectory = '') {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const relativePath = path.join(relativeDirectory, entry.name)
    const absolutePath = path.join(directory, entry.name)

    if (entry.isSymbolicLink()) {
      throw new Error(`Deployment artifact must not contain symbolic links: ${relativePath}`)
    }
    if (entry.isDirectory()) {
      files.push(...await collectFiles(absolutePath, relativePath))
    } else if (entry.isFile()) {
      files.push({ absolutePath, relativePath })
    }
  }

  return files
}

function readAttributes(tag) {
  const attributes = new Map()
  const attributePattern = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g
  let match

  while ((match = attributePattern.exec(tag)) !== null) {
    attributes.set(match[1].toLowerCase(), match[2] ?? match[3] ?? match[4] ?? '')
  }

  return attributes
}

function collectLocalReferences(indexHtml) {
  const references = []
  const tagPattern = /<(script|link|img)\b[^>]*>/gi
  let match

  while ((match = tagPattern.exec(indexHtml)) !== null) {
    const tagName = match[1].toLowerCase()
    const attributes = readAttributes(match[0])

    if (tagName === 'script' && attributes.has('src')) {
      references.push({ kind: 'script', url: attributes.get('src') })
    } else if (tagName === 'img' && attributes.has('src')) {
      references.push({ kind: 'image', url: attributes.get('src') })
    } else if (tagName === 'link' && attributes.has('href')) {
      const relations = (attributes.get('rel') ?? '').toLowerCase().split(/\s+/)
      if (relations.includes('stylesheet') || relations.some((relation) => relation.includes('icon'))) {
        references.push({ kind: relations.includes('stylesheet') ? 'stylesheet' : 'icon', url: attributes.get('href') })
      }
    }
  }

  return references.filter(({ url }) => {
    if (!url || url.startsWith('#') || url.startsWith('//')) {
      return false
    }
    return !/^[A-Za-z][A-Za-z0-9+.-]*:/.test(url)
  })
}

async function verifyReference(targetDirectory, reference) {
  if (!reference.url.startsWith(EXPECTED_BASE_PATH)) {
    throw new Error(`${reference.kind} URL does not use ${EXPECTED_BASE_PATH}: ${reference.url}`)
  }

  const parsedUrl = new URL(reference.url, 'https://skillhub.invalid/')
  const relativeUrl = decodeURIComponent(parsedUrl.pathname.slice(EXPECTED_BASE_PATH.length))
  const referencedPath = path.resolve(targetDirectory, relativeUrl)

  if (!isWithin(targetDirectory, referencedPath)) {
    throw new Error(`${reference.kind} URL escapes the deployment artifact: ${reference.url}`)
  }

  let referencedStats
  try {
    referencedStats = await stat(referencedPath)
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new Error(`${reference.kind} URL references a missing file: ${reference.url}`)
    }
    throw error
  }
  if (!referencedStats.isFile()) {
    throw new Error(`${reference.kind} URL does not reference a file: ${reference.url}`)
  }
}

function findCredentialKey(value, location = 'runtime config') {
  if (value === null || typeof value !== 'object') {
    return null
  }

  for (const [key, childValue] of Object.entries(value)) {
    const childLocation = `${location}.${key}`
    if (CREDENTIAL_KEY_PATTERN.test(key)) {
      return childLocation
    }
    const nestedMatch = findCredentialKey(childValue, childLocation)
    if (nestedMatch) {
      return nestedMatch
    }
  }

  return null
}

function looksLikeHtml(content) {
  return /<!doctype\s+html|<(?:html|head|body|script|div|main|section|article|p|span|h[1-6])\b/i.test(content)
}

async function main() {
  const targetDirectory = parseArguments(process.argv.slice(2))

  let targetStats
  try {
    targetStats = await lstat(targetDirectory)
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new Error(`Deployment artifact directory does not exist: ${targetDirectory}`)
    }
    throw error
  }
  if (!targetStats.isDirectory() || targetStats.isSymbolicLink()) {
    throw new Error(`Deployment artifact path is not a directory: ${targetDirectory}`)
  }

  const files = await collectFiles(targetDirectory)
  const fileByRelativePath = new Map(files.map((file) => [file.relativePath, file]))
  const indexFile = fileByRelativePath.get('index.html')
  const runtimeConfigFile = fileByRelativePath.get('runtime-config.js')
  const registryGuideFile = fileByRelativePath.get('registry/skill.md')

  if (!indexFile) {
    throw new Error('Deployment artifact is missing index.html')
  }
  if (!runtimeConfigFile) {
    throw new Error('Deployment artifact is missing runtime-config.js required by the official build')
  }
  if (!registryGuideFile) {
    throw new Error('Deployment artifact is missing registry/skill.md')
  }

  const placeholderBytes = Buffer.from(BASE_PATH_PLACEHOLDER)
  for (const file of files) {
    const content = await readFile(file.absolutePath)
    if (content.includes(placeholderBytes)) {
      throw new Error(`Unresolved Base Path placeholder remains in ${file.relativePath}`)
    }
    const decodedContent = content.toString('utf8')
    const filesystemPattern = LOCAL_FILESYSTEM_PATTERNS.find((pattern) => pattern.test(decodedContent))
    if (filesystemPattern) {
      throw new Error(`${file.relativePath} contains a local filesystem path`)
    }
  }

  const indexHtml = await readFile(indexFile.absolutePath, 'utf8')
  if (!/\bid=["']root["']/.test(indexHtml)) {
    throw new Error('index.html is missing the official React root (#root)')
  }
  if (!/\bid=["']skillhub-portals["']/.test(indexHtml)) {
    throw new Error('index.html is missing the official Portal host (#skillhub-portals)')
  }
  if (/(?:src|href)=["']\/assets\//i.test(indexHtml)) {
    throw new Error('index.html contains a root-level /assets/ URL that escapes /skillhub/')
  }

  const references = collectLocalReferences(indexHtml)
  if (references.length === 0) {
    throw new Error('index.html contains no local script, stylesheet, image, or icon references')
  }
  for (const reference of references) {
    await verifyReference(targetDirectory, reference)
  }

  for (const file of files) {
    if (!TEXT_ARTIFACT_EXTENSIONS.has(path.extname(file.relativePath))) {
      continue
    }
    const content = await readFile(file.absolutePath, 'utf8')
    if (/(?:^|["'`(=:\s])\/assets\//m.test(content)) {
      throw new Error(`${file.relativePath} contains a root-level /assets/ URL that escapes /skillhub/`)
    }
  }

  const runtimeConfigSource = await readFile(runtimeConfigFile.absolutePath, 'utf8')
  const runtimeScript = new vm.Script(runtimeConfigSource, { filename: runtimeConfigFile.absolutePath })
  const sandbox = { window: {} }
  runtimeScript.runInNewContext(sandbox, { timeout: 1000 })
  const runtimeConfig = sandbox.window.__SKILLHUB_RUNTIME_CONFIG__
  if (runtimeConfig === null || Array.isArray(runtimeConfig) || typeof runtimeConfig !== 'object') {
    throw new Error('runtime-config.js does not define window.__SKILLHUB_RUNTIME_CONFIG__ as an object')
  }
  const credentialKey = findCredentialKey(runtimeConfig)
  if (credentialKey) {
    throw new Error(`runtime-config.js contains a forbidden credential field: ${credentialKey}`)
  }

  const appBaseUrl = typeof runtimeConfig.appBaseUrl === 'string' ? runtimeConfig.appBaseUrl.trim() : ''
  if (!appBaseUrl) {
    throw new Error('runtime-config.js does not define the resolved public Registry base in appBaseUrl')
  }

  const registryGuide = await readFile(registryGuideFile.absolutePath, 'utf8')
  if (!registryGuide.trim()) {
    throw new Error('registry/skill.md is empty')
  }
  if (looksLikeHtml(registryGuide)) {
    throw new Error('registry/skill.md must be Markdown/plain text, not HTML or SPA content')
  }
  if (registryGuide.includes(PUBLIC_BASE_URL_PLACEHOLDER)) {
    throw new Error('registry/skill.md contains an unresolved public-base placeholder')
  }
  if (!registryGuide.includes(appBaseUrl)) {
    throw new Error('registry/skill.md does not contain the resolved public Registry base')
  }

  console.log(`Verified ${files.length} deployment files and ${references.length} local index references under ${EXPECTED_BASE_PATH}`)
}

main().catch((error) => {
  console.error(`Static deployment verification failed: ${error.message}`)
  process.exitCode = 1
})
