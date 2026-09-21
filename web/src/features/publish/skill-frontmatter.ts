export type SkillFrontmatterErrorCode =
  | 'empty'
  | 'missingStart'
  | 'missingContent'
  | 'missingEnd'
  | 'notMap'

export interface SkillFrontmatterValue {
  fields: Record<string, string>
  nested: Record<string, Record<string, string>>
}

export type SkillFrontmatterParseResult =
  | { ok: true; value: SkillFrontmatterValue }
  | { ok: false; errorCode: SkillFrontmatterErrorCode }

const FRONTMATTER_DELIMITER = '---'
const BLOCK_SCALAR_PATTERN = /^[|>][+-]?[0-9]*$/

function stripWrappingQuotes(value: string): string {
  if (value.length >= 2) {
    const wrappedInDoubleQuotes = value.startsWith('"') && value.endsWith('"')
    const wrappedInSingleQuotes = value.startsWith("'") && value.endsWith("'")
    if (wrappedInDoubleQuotes || wrappedInSingleQuotes) {
      return value.slice(1, -1)
    }
  }
  return value
}

function splitLines(content: string): string[] {
  return content.split(/\r?\n/)
}

function parseMappingLine(line: string): { key: string; value: string } | null {
  const separatorIndex = line.indexOf(':')
  if (separatorIndex <= 0) {
    return null
  }
  const key = line.slice(0, separatorIndex).trim()
  const value = line.slice(separatorIndex + 1).trim()
  if (!key || key.includes(' ')) {
    return null
  }
  return { key, value }
}

function collectBlockScalar(lines: string[], start: number, indicator: string): { text: string; next: number } {
  const folded = indicator.startsWith('>')
  const collected: string[] = []
  let index = start
  while (index < lines.length && (lines[index].trim() === '' || /^[ \t]/.test(lines[index]))) {
    collected.push(lines[index].replace(/^[ \t]+/, ''))
    index += 1
  }
  while (collected.length > 0 && collected[collected.length - 1].trim() === '') {
    collected.pop()
  }
  const text = folded ? collected.join(' ') : collected.join('\n')
  return { text, next: index }
}

function collectNestedMap(lines: string[], start: number): { map: Record<string, string>; next: number } {
  const map: Record<string, string> = {}
  let index = start
  while (index < lines.length) {
    const rawLine = lines[index]
    if (rawLine.trim() === '') {
      index += 1
      continue
    }
    if (!/^[ \t]/.test(rawLine)) {
      break
    }
    const mapping = parseMappingLine(rawLine.trim())
    if (mapping) {
      map[mapping.key] = stripWrappingQuotes(mapping.value)
    }
    index += 1
  }
  return { map, next: index }
}

function parseYamlSubset(yamlContent: string): SkillFrontmatterValue | null {
  const lines = splitLines(yamlContent)
  const fields: Record<string, string> = {}
  const nested: Record<string, Record<string, string>> = {}
  let foundMapping = false

  let index = 0
  while (index < lines.length) {
    const rawLine = lines[index]
    index += 1
    const line = rawLine.trim()
    if (!line || line.startsWith('#') || line.startsWith('-')) {
      continue
    }
    if (/^[ \t]/.test(rawLine)) {
      continue
    }

    const mapping = parseMappingLine(line)
    if (!mapping) {
      continue
    }
    foundMapping = true
    const { key, value } = mapping

    if (BLOCK_SCALAR_PATTERN.test(value)) {
      const block = collectBlockScalar(lines, index, value)
      fields[key] = block.text
      index = block.next
      continue
    }

    if (value !== '') {
      fields[key] = stripWrappingQuotes(value)
      continue
    }

    let nextContentIndex = index
    while (nextContentIndex < lines.length && lines[nextContentIndex].trim() === '') {
      nextContentIndex += 1
    }
    const nextLine = lines[nextContentIndex] ?? ''
    if (!/^[ \t]/.test(nextLine)) {
      continue
    }

    const nestedLine = nextLine.trim()
    const nestedMapping = parseMappingLine(nestedLine)
    if (nestedMapping && !nestedLine.startsWith('#')) {
      const collected = collectNestedMap(lines, nextContentIndex)
      nested[key] = collected.map
      index = Math.max(index, collected.next)
    }
  }

  return foundMapping ? { fields, nested } : null
}

export function parseSkillMdFrontmatter(content: string): SkillFrontmatterParseResult {
  if (!content || !content.trim()) {
    return { ok: false, errorCode: 'empty' }
  }

  const trimmedContent = content.trim()
  if (!trimmedContent.startsWith(FRONTMATTER_DELIMITER)) {
    return { ok: false, errorCode: 'missingStart' }
  }

  const firstDelimiterEnd = trimmedContent.indexOf('\n', FRONTMATTER_DELIMITER.length)
  if (firstDelimiterEnd === -1) {
    return { ok: false, errorCode: 'missingContent' }
  }

  const secondDelimiterStart = trimmedContent.indexOf(FRONTMATTER_DELIMITER, firstDelimiterEnd + 1)
  if (secondDelimiterStart === -1) {
    return { ok: false, errorCode: 'missingEnd' }
  }

  const yamlContent = trimmedContent.slice(firstDelimiterEnd + 1, secondDelimiterStart).trim()
  const parsed = parseYamlSubset(yamlContent)
  if (!parsed) {
    return { ok: false, errorCode: 'notMap' }
  }
  return { ok: true, value: parsed }
}
