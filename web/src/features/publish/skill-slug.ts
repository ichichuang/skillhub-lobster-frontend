export const SKILL_SLUG_MIN_LENGTH = 2
export const SKILL_SLUG_MAX_LENGTH = 64

const SLUG_PATTERN = /^[\p{L}\p{N}\p{So}][\p{L}\p{N}\p{So}-]*[\p{L}\p{N}\p{So}]$/u
const UPPERCASE_PATTERN = /[A-Z]/

const RESERVED_SLUGS = new Set([
  'admin', 'api', 'dashboard', 'search', 'auth',
  'me', 'global', 'system', 'static', 'assets', 'health',
])

export type SkillSlugValidationResult =
  | 'ok'
  | 'blank'
  | 'length'
  | 'pattern'
  | 'doubleHyphen'
  | 'reserved'

export function slugifySkillName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{So}]+/gu, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
    .replace(/-{2,}/g, '-')
}

export function validateSkillSlug(slug: string): SkillSlugValidationResult {
  if (!slug || !slug.trim()) {
    return 'blank'
  }
  if (slug.length < SKILL_SLUG_MIN_LENGTH || slug.length > SKILL_SLUG_MAX_LENGTH) {
    return 'length'
  }
  if (UPPERCASE_PATTERN.test(slug)) {
    return 'pattern'
  }
  if (!SLUG_PATTERN.test(slug)) {
    return 'pattern'
  }
  if (slug.includes('--')) {
    return 'doubleHyphen'
  }
  if (RESERVED_SLUGS.has(slug)) {
    return 'reserved'
  }
  return 'ok'
}
