import { describe, expect, it } from 'vitest'
import {
  extractPrecheckWarnings,
  isFrontmatterFailureMessage,
  isPrecheckConfirmationMessage,
  isPrecheckFailureMessage,
  isVersionExistsMessage,
  matchServerPreflightFailure,
} from './publish-error-utils'

describe('publish-error-utils', () => {
  it('detects confirmation-required warnings in English', () => {
    expect(isPrecheckConfirmationMessage('Pre-publish warnings require confirmation before publishing:\n- warning')).toBe(true)
  })

  it('detects confirmation-required warnings in Chinese', () => {
    expect(isPrecheckConfirmationMessage('预发布发现以下风险提醒，确认后仍可继续发布：\n- 风险提醒')).toBe(true)
  })

  it('extracts warning lines from a confirmation message', () => {
    expect(extractPrecheckWarnings(
      'Pre-publish warnings require confirmation before publishing:\n- Disallowed file extension: malware.exe\n- SKILL.md line 5 contains a value that looks like a secret or token.'
    )).toEqual([
      'Disallowed file extension: malware.exe',
      'SKILL.md line 5 contains a value that looks like a secret or token.',
    ])
  })

  it('keeps existing blocking precheck detection', () => {
    expect(isPrecheckFailureMessage('Pre-publish validation failed: validator blocked publish')).toBe(true)
  })

  it('keeps version and frontmatter detection helpers', () => {
    expect(isVersionExistsMessage('Version already exists')).toBe(true)
    expect(isFrontmatterFailureMessage('Invalid SKILL.md frontmatter')).toBe(true)
  })

  it('matches server errors that duplicate the missing SKILL.md preflight check', () => {
    expect(matchServerPreflightFailure('Package validation failed: Missing required file: SKILL.md at root')).toBe('skill-md-missing')
    expect(matchServerPreflightFailure('技能包校验失败：Missing required file: SKILL.md at root')).toBe('skill-md-missing')
    expect(matchServerPreflightFailure('SKILL.md not found')).toBe('skill-md-missing')
    expect(matchServerPreflightFailure('未找到 SKILL.md')).toBe('skill-md-missing')
  })

  it('matches server errors for missing name and description fields', () => {
    expect(matchServerPreflightFailure('Missing required field: name')).toBe('name-missing')
    expect(matchServerPreflightFailure('缺少必填字段：name')).toBe('name-missing')
    expect(matchServerPreflightFailure('Missing required field: description')).toBe('description-missing')
    expect(matchServerPreflightFailure('缺少必填字段：description')).toBe('description-missing')
  })

  it('prefers the field-specific kind when the validator wraps a metadata error', () => {
    expect(
      matchServerPreflightFailure('Invalid SKILL.md frontmatter: Missing required field: name'),
    ).toBe('name-missing')
    expect(
      matchServerPreflightFailure('Package validation failed: Invalid SKILL.md frontmatter: Missing required field: description'),
    ).toBe('description-missing')
  })

  it('maps slug violations to the name-invalid kind', () => {
    expect(matchServerPreflightFailure("Slug 'admin' is reserved and cannot be used")).toBe('name-invalid')
    expect(matchServerPreflightFailure('slug 长度必须在 2 到 64 个字符之间')).toBe('name-invalid')
  })

  it('matches ambiguous and malformed-frontmatter server errors', () => {
    expect(matchServerPreflightFailure('Ambiguous package: SKILL.md found in multiple directories: [a, b]')).toBe('skill-md-ambiguous')
    expect(matchServerPreflightFailure('Missing frontmatter start marker \'---\'')).toBe('frontmatter-invalid')
    expect(matchServerPreflightFailure('缺少 frontmatter 结束标记 ---')).toBe('frontmatter-invalid')
  })

  it('returns null for unknown server errors so diagnostics stay visible', () => {
    expect(matchServerPreflightFailure('Namespace is frozen')).toBeNull()
    expect(matchServerPreflightFailure(undefined)).toBeNull()
  })
})
