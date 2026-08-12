import { cp, lstat, mkdir, readFile, readdir, realpath, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateBasePath } from '../base-path-config.ts'

const BASE_PATH_PLACEHOLDER = '/__SKILLHUB_WEB_BASE_PATH__/'
const PUBLIC_BASE_URL_PLACEHOLDER = '${SKILLHUB_PUBLIC_BASE_URL}'
const TEXT_ARTIFACT_EXTENSIONS = new Set(['.css', '.html', '.js'])
const ALLOWED_CONFIG_FIELDS = new Set(['appBaseUrl', 'output', 'webBasePath'])

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const webRoot = path.resolve(scriptDirectory, '..')
const sourceDirectory = path.join(webRoot, 'dist')
const registryGuideTemplate = path.join(webRoot, 'src/docs/skill.md.template')

function usage() {
  return 'Usage: node scripts/render-static-deployment.mjs --config <config.json>'
}

function parseArguments(argumentsList) {
  const normalizedArguments = argumentsList[0] === '--' ? argumentsList.slice(1) : argumentsList

  if (normalizedArguments.length !== 2 || normalizedArguments[0] !== '--config' || !normalizedArguments[1]) {
    throw new Error(usage())
  }

  return normalizedArguments[1]
}

function isWithin(parent, candidate) {
  const relativePath = path.relative(parent, candidate)
  return relativePath === '' || (!relativePath.startsWith(`..${path.sep}`) && relativePath !== '..' && !path.isAbsolute(relativePath))
}

function pathsOverlap(left, right) {
  return isWithin(left, right) || isWithin(right, left)
}

async function nearestExistingAncestor(candidate) {
  let current = candidate

  while (true) {
    try {
      await lstat(current)
      return current
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        throw error
      }
    }

    const parent = path.dirname(current)
    if (parent === current) {
      throw new Error(`Unable to resolve an existing ancestor for output path: ${candidate}`)
    }
    current = parent
  }
}

async function validateOutputPath(output) {
  if (typeof output !== 'string' || output.trim() === '') {
    throw new Error('Static deployment config field "output" must be a non-empty string')
  }

  if (output.split(/[\\/]+/).includes('..')) {
    throw new Error(`Static deployment output must not contain traversal segments: ${output}`)
  }

  const outputDirectory = path.resolve(webRoot, output)
  if (outputDirectory === path.parse(outputDirectory).root) {
    throw new Error(`Static deployment output must not be a filesystem root: ${output}`)
  }

  const canonicalWebRoot = await realpath(webRoot)
  const existingAncestor = await nearestExistingAncestor(outputDirectory)
  const canonicalAncestor = await realpath(existingAncestor)
  const canonicalOutput = path.join(canonicalAncestor, path.relative(existingAncestor, outputDirectory))

  if (!isWithin(canonicalWebRoot, canonicalOutput)) {
    throw new Error(`Static deployment output must stay inside ${webRoot}: ${output}`)
  }

  const canonicalSource = await realpath(sourceDirectory)
  if (pathsOverlap(canonicalSource, canonicalOutput)) {
    throw new Error(`Static deployment output must not overlap the source dist directory: ${output}`)
  }

  return outputDirectory
}

async function collectFiles(directory, relativeDirectory = '') {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const relativePath = path.join(relativeDirectory, entry.name)
    const absolutePath = path.join(directory, entry.name)

    if (entry.isSymbolicLink()) {
      throw new Error(`Static deployment input must not contain symbolic links: ${relativePath}`)
    }
    if (entry.isDirectory()) {
      files.push(...await collectFiles(absolutePath, relativePath))
    } else if (entry.isFile()) {
      files.push({ absolutePath, relativePath })
    }
  }

  return files
}

async function loadConfig(configArgument) {
  const configPath = path.resolve(process.cwd(), configArgument)
  let config

  try {
    config = JSON.parse(await readFile(configPath, 'utf8'))
  } catch (error) {
    throw new Error(`Unable to read static deployment config ${configPath}: ${error.message}`, { cause: error })
  }

  if (config === null || Array.isArray(config) || typeof config !== 'object') {
    throw new Error('Static deployment config must be a JSON object')
  }

  const unknownFields = Object.keys(config).filter((field) => !ALLOWED_CONFIG_FIELDS.has(field))
  if (unknownFields.length > 0) {
    throw new Error(`Unknown static deployment config field(s): ${unknownFields.join(', ')}`)
  }
  for (const requiredField of ALLOWED_CONFIG_FIELDS) {
    if (!Object.hasOwn(config, requiredField)) {
      throw new Error(`Static deployment config is missing required field: ${requiredField}`)
    }
  }
  if (typeof config.webBasePath !== 'string') {
    throw new Error('Static deployment config field "webBasePath" must be a string')
  }

  return config
}

function validateAppBaseUrl(value, webBasePath) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('Static deployment config field "appBaseUrl" must be a non-empty absolute HTTP(S) URL')
  }

  let parsedUrl
  try {
    parsedUrl = new URL(value)
  } catch {
    throw new Error('Static deployment config field "appBaseUrl" must be a valid absolute URL')
  }
  if (!['http:', 'https:'].includes(parsedUrl.protocol) || !parsedUrl.host) {
    throw new Error('Static deployment config field "appBaseUrl" must use HTTP or HTTPS and include a host')
  }
  if (parsedUrl.username || parsedUrl.password || parsedUrl.search || parsedUrl.hash) {
    throw new Error('Static deployment config field "appBaseUrl" must not contain credentials, a query, or a fragment')
  }
  if (value.endsWith('/')) {
    throw new Error('Static deployment config field "appBaseUrl" must not end with a slash')
  }

  const expectedPath = webBasePath === '/' ? '' : webBasePath.slice(0, -1)
  if (parsedUrl.pathname !== (expectedPath || '/')) {
    throw new Error(`Static deployment config field "appBaseUrl" path must match webBasePath (${expectedPath || '/'})`)
  }

  return value
}

async function writeResolvedRuntimeConfig(outputDirectory, appBaseUrl) {
  const runtimeConfigPath = path.join(outputDirectory, 'runtime-config.js')
  const runtimeConfig = await readFile(runtimeConfigPath, 'utf8')
  let replacements = 0
  const resolvedRuntimeConfig = runtimeConfig.replace(
    /(\bappBaseUrl\s*:\s*)(['"])(.*?)\2/,
    (_match, propertyPrefix) => {
      replacements += 1
      return `${propertyPrefix}${JSON.stringify(appBaseUrl)}`
    },
  )
  if (replacements !== 1) {
    throw new Error('runtime-config.js must define exactly one string-valued appBaseUrl field')
  }
  await writeFile(runtimeConfigPath, resolvedRuntimeConfig, 'utf8')
}

async function writeRegistryGuide(outputDirectory, appBaseUrl) {
  const template = await readFile(registryGuideTemplate, 'utf8')
  if (!template.includes(PUBLIC_BASE_URL_PLACEHOLDER)) {
    throw new Error(`Registry guide template is missing ${PUBLIC_BASE_URL_PLACEHOLDER}`)
  }

  const guide = template.split(PUBLIC_BASE_URL_PLACEHOLDER).join(appBaseUrl)
  if (!guide.trim() || guide.includes(PUBLIC_BASE_URL_PLACEHOLDER)) {
    throw new Error('Registry guide could not be resolved from appBaseUrl')
  }

  const registryDirectory = path.join(outputDirectory, 'registry')
  await mkdir(registryDirectory, { recursive: true })
  await writeFile(path.join(registryDirectory, 'skill.md'), guide, 'utf8')
}

async function main() {
  const config = await loadConfig(parseArguments(process.argv.slice(2)))
  const webBasePath = validateBasePath(config.webBasePath)
  const appBaseUrl = validateAppBaseUrl(config.appBaseUrl, webBasePath)

  let sourceStats
  try {
    sourceStats = await stat(sourceDirectory)
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new Error(`Production build directory does not exist: ${sourceDirectory}. Run the official placeholder build before packaging.`)
    }
    throw error
  }
  if (!sourceStats.isDirectory()) {
    throw new Error(`Production build path is not a directory: ${sourceDirectory}`)
  }

  const outputDirectory = await validateOutputPath(config.output)
  const sourceFiles = await collectFiles(sourceDirectory)
  let placeholderCount = 0

  for (const file of sourceFiles) {
    if (!TEXT_ARTIFACT_EXTENSIONS.has(path.extname(file.relativePath))) {
      continue
    }
    const content = await readFile(file.absolutePath, 'utf8')
    placeholderCount += content.split(BASE_PATH_PLACEHOLDER).length - 1
  }

  if (placeholderCount === 0) {
    throw new Error(
      `Production build does not contain the official Base Path placeholder ${BASE_PATH_PLACEHOLDER}. Rebuild dist with VITE_BASE_PATH=${BASE_PATH_PLACEHOLDER}.`,
    )
  }

  await rm(outputDirectory, { force: true, recursive: true })
  await cp(sourceDirectory, outputDirectory, { recursive: true })

  const outputFiles = await collectFiles(outputDirectory)
  for (const file of outputFiles) {
    if (!TEXT_ARTIFACT_EXTENSIONS.has(path.extname(file.relativePath))) {
      continue
    }
    const content = await readFile(file.absolutePath, 'utf8')
    if (content.includes(BASE_PATH_PLACEHOLDER)) {
      await writeFile(
        file.absolutePath,
        content.split(BASE_PATH_PLACEHOLDER).join(webBasePath),
        'utf8',
      )
    }
  }

  await writeResolvedRuntimeConfig(outputDirectory, appBaseUrl)
  await writeRegistryGuide(outputDirectory, appBaseUrl)

  const unresolvedFiles = []
  const placeholderBytes = Buffer.from(BASE_PATH_PLACEHOLDER)
  const resolvedOutputFiles = await collectFiles(outputDirectory)
  for (const file of resolvedOutputFiles) {
    if ((await readFile(file.absolutePath)).includes(placeholderBytes)) {
      unresolvedFiles.push(file.relativePath)
    }
  }
  if (unresolvedFiles.length > 0) {
    throw new Error(`Unresolved Base Path placeholder remains in: ${unresolvedFiles.join(', ')}`)
  }

  console.log(`Rendered ${resolvedOutputFiles.length} files to ${outputDirectory} with webBasePath=${webBasePath} and appBaseUrl=${appBaseUrl}`)
}

main().catch((error) => {
  console.error(`Static deployment packaging failed: ${error.message}`)
  process.exitCode = 1
})
