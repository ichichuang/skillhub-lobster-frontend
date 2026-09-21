import { openZipArchive, ZipReadError, type ZipEntry } from './zip-reader'
import { parseSkillMdFrontmatter } from './skill-frontmatter'
import { slugifySkillName, validateSkillSlug } from './skill-slug'

export const SKILL_MD_PATH = 'SKILL.md'

export type PreflightCheckId = 'skillMd' | 'frontmatter' | 'name' | 'description'

export interface PreflightCheckFailure {
  messageKey: string
  params?: Record<string, string>
}

export interface PreflightCheck {
  id: PreflightCheckId
  labelKey: string
  passed: boolean
  failure?: PreflightCheckFailure
}

export interface SkillPackageMetadata {
  name?: string
  description?: string
  version?: string
}

export interface PackagePreflightResult {
  state: 'ready' | 'unreadable'
  blocked: boolean
  failure?: PreflightCheckFailure
  checks: PreflightCheck[]
  metadata: SkillPackageMetadata
}

export type PackagePreflight = { state: 'checking' } | PackagePreflightResult

interface NormalizedArchive {
  pathByEntry: Map<string, ZipEntry>
  ambiguousSkillMd: boolean
}

function isOsMetadataEntry(path: string): boolean {
  if (path.startsWith('__MACOSX/') || path === '__MACOSX') {
    return true
  }
  const slashIndex = path.lastIndexOf('/')
  const fileName = slashIndex >= 0 ? path.slice(slashIndex + 1) : path
  return fileName === '.DS_Store' || fileName.startsWith('._')
}

function normalizeEntryPath(rawPath: string): string | null {
  const sanitized = rawPath.replace(/\\/g, '/').replace(/\/+$/, '')
  if (!sanitized || sanitized.startsWith('/') || sanitized.includes(':')) {
    return null
  }
  const segments = sanitized.split('/')
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    return null
  }
  const fileName = segments[segments.length - 1]
  if (fileName.toLowerCase() === SKILL_MD_PATH.toLowerCase()) {
    segments[segments.length - 1] = SKILL_MD_PATH
  }
  return segments.join('/')
}

function stripSingleRootDirectory(entries: Array<{ path: string; entry: ZipEntry }>): Array<{ path: string; entry: ZipEntry }> {
  if (entries.length === 0) {
    return entries
  }

  const rootSegments = new Set<string>()
  for (const item of entries) {
    const slashIndex = item.path.indexOf('/')
    if (slashIndex < 0) {
      return entries
    }
    rootSegments.add(item.path.slice(0, slashIndex))
  }
  if (rootSegments.size !== 1) {
    return entries
  }

  const prefix = `${rootSegments.values().next().value}/`
  return entries
    .filter((item) => item.path.startsWith(prefix) && item.path.length > prefix.length)
    .map((item) => ({ path: item.path.slice(prefix.length), entry: item.entry }))
}

function buildNormalizedArchive(entries: ZipEntry[]): NormalizedArchive {
  const fileEntries = entries
    .filter((entry) => !entry.isDirectory && !isOsMetadataEntry(entry.path))
    .map((entry) => {
      const normalizedPath = normalizeEntryPath(entry.path)
      return normalizedPath ? { path: normalizedPath, entry } : null
    })
    .filter((item): item is { path: string; entry: ZipEntry } => item !== null)

  let normalized = stripSingleRootDirectory(fileEntries)
  let ambiguousSkillMd = false
  const hasRootSkillMd = normalized.some((item) => item.path === SKILL_MD_PATH)

  if (!hasRootSkillMd) {
    const skillMdDirs = new Set<string>()
    for (const item of normalized) {
      const slashIndex = item.path.indexOf('/')
      if (slashIndex > 0 && item.path.slice(slashIndex + 1) === SKILL_MD_PATH) {
        skillMdDirs.add(item.path.slice(0, slashIndex))
      }
    }
    if (skillMdDirs.size > 1) {
      ambiguousSkillMd = true
    } else if (skillMdDirs.size === 1) {
      const prefix = `${skillMdDirs.values().next().value}/`
      normalized = normalized
        .filter((item) => item.path.startsWith(prefix))
        .map((item) => ({ path: item.path.slice(prefix.length), entry: item.entry }))
    }
  }

  const pathByEntry = new Map(normalized.map((item) => [item.path, item.entry]))
  return { pathByEntry, ambiguousSkillMd }
}

function evaluateFrontmatter(
  content: string,
  checks: PreflightCheck[],
  metadata: SkillPackageMetadata,
): boolean {
  const parsed = parseSkillMdFrontmatter(content)
  if (!parsed.ok) {
    checks.push({
      id: 'frontmatter',
      labelKey: 'publish.preflight.frontmatterLabel',
      passed: false,
      failure: { messageKey: 'publish.preflight.frontmatterInvalid' },
    })
    return false
  }

  const { fields, nested } = parsed.value

  const name = fields.name
  let nameValid = false
  if (name === undefined || !name.trim()) {
    checks.push({
      id: 'name',
      labelKey: 'publish.preflight.nameLabel',
      passed: false,
      failure: { messageKey: 'publish.preflight.nameMissing' },
    })
  } else {
    const slug = slugifySkillName(name)
    const slugResult = validateSkillSlug(slug)
    if (slugResult === 'ok') {
      checks.push({ id: 'name', labelKey: 'publish.preflight.nameLabel', passed: true })
      metadata.name = name
      nameValid = true
    } else {
      checks.push({
        id: 'name',
        labelKey: 'publish.preflight.nameLabel',
        passed: false,
        failure: {
          messageKey: slugResult === 'length'
            ? 'publish.preflight.nameInvalidLength'
            : slugResult === 'reserved'
              ? 'publish.preflight.nameInvalidReserved'
              : 'publish.preflight.nameInvalidPattern',
          params: { slug },
        },
      })
    }
  }

  const description = fields.description
  if (description === undefined || !description.trim()) {
    checks.push({
      id: 'description',
      labelKey: 'publish.preflight.descriptionLabel',
      passed: false,
      failure: { messageKey: 'publish.preflight.descriptionMissing' },
    })
  } else {
    checks.push({ id: 'description', labelKey: 'publish.preflight.descriptionLabel', passed: true })
    metadata.description = description
  }

  const version = fields.version ?? nested.metadata?.version
  if (version !== undefined && version.trim()) {
    metadata.version = version
  }

  return nameValid
}

export async function runPackagePreflight(file: Blob): Promise<PackagePreflightResult> {
  let archive
  try {
    archive = await openZipArchive(file)
  } catch (error) {
    if (error instanceof ZipReadError && error.reason === 'not-zip') {
      return {
        state: 'ready',
        blocked: true,
        failure: { messageKey: 'publish.preflight.zipUnreadable' },
        checks: [],
        metadata: {},
      }
    }
    return { state: 'unreadable', blocked: false, checks: [], metadata: {} }
  }

  const { pathByEntry, ambiguousSkillMd } = buildNormalizedArchive(archive.entries)
  const checks: PreflightCheck[] = []
  const metadata: SkillPackageMetadata = {}

  if (ambiguousSkillMd) {
    checks.push({
      id: 'skillMd',
      labelKey: 'publish.preflight.skillMdLabel',
      passed: false,
      failure: { messageKey: 'publish.preflight.skillMdAmbiguous' },
    })
    return { state: 'ready', blocked: true, checks, metadata }
  }

  const skillMdEntry = pathByEntry.get(SKILL_MD_PATH)
  if (!skillMdEntry) {
    checks.push({
      id: 'skillMd',
      labelKey: 'publish.preflight.skillMdLabel',
      passed: false,
      failure: { messageKey: 'publish.preflight.skillMdMissing' },
    })
    return { state: 'ready', blocked: true, checks, metadata }
  }

  checks.push({ id: 'skillMd', labelKey: 'publish.preflight.skillMdLabel', passed: true })

  let skillMdContent: string
  try {
    skillMdContent = await archive.readEntryText(skillMdEntry)
  } catch {
    return { state: 'unreadable', blocked: false, checks: [], metadata: {} }
  }

  evaluateFrontmatter(skillMdContent, checks, metadata)
  const blocked = checks.some((check) => !check.passed)
  return { state: 'ready', blocked, checks, metadata }
}
