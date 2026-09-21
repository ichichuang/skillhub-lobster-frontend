const PRECHECK_CONFIRM_MARKERS = [
  'Pre-publish warnings require confirmation before publishing',
  '预发布发现以下风险提醒，确认后仍可继续发布',
]

const PRECHECK_FAILURE_MARKERS = [
  'error.skill.publish.precheck.failed',
  'Pre-publish validation failed',
  '预发布校验失败',
  'looks like a secret or token',
]

const VERSION_EXISTS_MARKERS = [
  'error.skill.version.exists',
  'Version already exists',
  '版本已存在',
]

const FRONTMATTER_FAILURE_MARKERS = [
  'Invalid SKILL.md frontmatter',
  '技能包校验失败：Invalid SKILL.md frontmatter',
]

const SERVER_SKILL_MD_MISSING_MARKERS = [
  'Missing required file: SKILL.md at root',
  'SKILL.md not found',
  '未找到 SKILL.md',
]

const SERVER_SKILL_MD_AMBIGUOUS_MARKERS = [
  'SKILL.md found in multiple directories',
]

const SERVER_NAME_MISSING_MARKERS = [
  'Missing required field: name',
  '缺少必填字段：name',
]

const SERVER_DESCRIPTION_MISSING_MARKERS = [
  'Missing required field: description',
  '缺少必填字段：description',
]

const SERVER_FRONTMATTER_INVALID_MARKERS = [
  'Missing frontmatter start marker',
  'Missing frontmatter content after start marker',
  'Missing frontmatter end marker',
  'Frontmatter must be a YAML object',
  'Invalid YAML in frontmatter',
  '缺少 frontmatter 起始标记',
  'frontmatter 起始标记后缺少内容',
  '缺少 frontmatter 结束标记',
  'frontmatter 必须是 YAML 对象',
  'frontmatter YAML 非法',
]

const SERVER_NAME_INVALID_MARKERS = [
  'Slug cannot be blank',
  'Slug length must be between',
  'Slug must contain only lowercase',
  'Slug cannot contain consecutive hyphens',
  'is reserved and cannot be used',
  'slug 不能为空',
  'slug 长度必须在',
  'slug 只能包含小写字母',
  'slug 不能包含连续连字符',
  '是保留字',
]

export type ServerPreflightFailureKind =
  | 'skill-md-missing'
  | 'skill-md-ambiguous'
  | 'name-missing'
  | 'name-invalid'
  | 'description-missing'
  | 'frontmatter-invalid'

const SERVER_PREFLIGHT_KIND_MARKERS: Array<[ServerPreflightFailureKind, string[]]> = [
  ['description-missing', SERVER_DESCRIPTION_MISSING_MARKERS],
  ['name-missing', SERVER_NAME_MISSING_MARKERS],
  ['skill-md-missing', SERVER_SKILL_MD_MISSING_MARKERS],
  ['skill-md-ambiguous', SERVER_SKILL_MD_AMBIGUOUS_MARKERS],
  ['name-invalid', SERVER_NAME_INVALID_MARKERS],
  ['frontmatter-invalid', SERVER_FRONTMATTER_INVALID_MARKERS],
]

function includesAnyMarker(message: string | undefined, markers: string[]): boolean {
  if (!message) {
    return false
  }

  return markers.some((marker) => message.includes(marker))
}

export function isVersionExistsMessage(message?: string): boolean {
  return includesAnyMarker(message, VERSION_EXISTS_MARKERS)
}

export function isPrecheckFailureMessage(message?: string): boolean {
  return includesAnyMarker(message, PRECHECK_FAILURE_MARKERS)
}

export function isPrecheckConfirmationMessage(message?: string): boolean {
  return includesAnyMarker(message, PRECHECK_CONFIRM_MARKERS)
}

export function isFrontmatterFailureMessage(message?: string): boolean {
  return includesAnyMarker(message, FRONTMATTER_FAILURE_MARKERS)
}

export function matchServerPreflightFailure(message?: string): ServerPreflightFailureKind | null {
  if (!message) {
    return null
  }
  for (const [kind, markers] of SERVER_PREFLIGHT_KIND_MARKERS) {
    if (includesAnyMarker(message, markers)) {
      return kind
    }
  }
  return null
}

export function extractPrecheckWarnings(message?: string): string[] {
  if (!message) {
    return []
  }

  const normalized = message.replace(/\r/g, '').trim()
  if (!normalized) {
    return []
  }

  return normalized
    .split('\n')
    .map((line, index) => {
      const trimmed = line.trim()
      if (!trimmed) {
        return null
      }

      if (index === 0 && isPrecheckConfirmationMessage(trimmed)) {
        const firstWarning = trimmed.replace(/^.*?[：:]\s*/, '').trim()
        return firstWarning && !isPrecheckConfirmationMessage(firstWarning) ? firstWarning : null
      }

      return trimmed.replace(/^[-*•]\s*/, '')
    })
    .filter((line): line is string => Boolean(line))
}
