import { describe, expect, it } from 'vitest'
import { parseSkillMdFrontmatter } from './skill-frontmatter'

describe('parseSkillMdFrontmatter', () => {
  it('extracts authoritative name, description, and version fields', () => {
    const result = parseSkillMdFrontmatter(
      '---\nname: memory-keeper\ndescription: 保存并整理会话记忆\nversion: 1.2.0\n---\n\n# body',
    )

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.fields.name).toBe('memory-keeper')
      expect(result.value.fields.description).toBe('保存并整理会话记忆')
      expect(result.value.fields.version).toBe('1.2.0')
    }
  })

  it('falls back to nested metadata.version for the version field', () => {
    const result = parseSkillMdFrontmatter(
      '---\nname: nested\ndescription: d\nmetadata:\n  version: 2.0.0\n---\n',
    )

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.fields.version).toBeUndefined()
      expect(result.value.nested.metadata?.version).toBe('2.0.0')
    }
  })

  it('unwraps quoted values', () => {
    const result = parseSkillMdFrontmatter('---\nname: "quoted"\ndescription: \'single\'\n---\n')

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.fields.name).toBe('quoted')
      expect(result.value.fields.description).toBe('single')
    }
  })

  it('collects block scalar descriptions for multiline copy', () => {
    const result = parseSkillMdFrontmatter(
      '---\nname: blocky\ndescription: |\n  第一行说明\n  第二行说明\n---\n',
    )

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.fields.description).toBe('第一行说明\n第二行说明')
    }
  })

  it('reports a missing name field when the key is absent', () => {
    const result = parseSkillMdFrontmatter('---\ndescription: d\n---\n')

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.fields.name).toBeUndefined()
    }
  })

  it('reports a missing description field when the key is absent or null', () => {
    const absent = parseSkillMdFrontmatter('---\nname: x\n---\n')
    expect(absent.ok).toBe(true)
    if (absent.ok) {
      expect(absent.value.fields.description).toBeUndefined()
    }

    const nullValue = parseSkillMdFrontmatter('---\nname: x\ndescription:\n---\n')
    expect(nullValue.ok).toBe(true)
    if (nullValue.ok) {
      expect(nullValue.value.fields.description).toBeUndefined()
    }
  })

  it('keeps blank-string values so the preflight can apply the stricter blank rule', () => {
    const result = parseSkillMdFrontmatter('---\nname: x\ndescription: "   "\n---\n')

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.fields.description).toBe('   ')
    }
  })

  it.each([
    ['empty content', '', 'empty'],
    ['missing start marker', 'name: x\n', 'missingStart'],
    ['missing content after start marker', '---', 'missingContent'],
    ['missing end marker', '---\nname: x\n', 'missingEnd'],
    ['not a mapping', '---\n- just\n- a list\n---\n', 'notMap'],
  ] as const)('rejects malformed frontmatter: %s', (_label, content, errorCode) => {
    const result = parseSkillMdFrontmatter(content)
    expect(result).toEqual({ ok: false, errorCode })
  })
})
