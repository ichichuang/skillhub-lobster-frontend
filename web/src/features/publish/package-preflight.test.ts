import { describe, expect, it } from 'vitest'
import { runPackagePreflight, type PreflightCheck } from './package-preflight'
import { buildStoreZip, makeZipFile, skillMdContent } from './zip-test-builder'

const VALID_SKILL_MD = skillMdContent('memory-keeper', '保存并整理会话记忆，支持按项目归档。', '1.2.0')

async function preflight(files: Array<{ path: string; content: string }>) {
  return runPackagePreflight(new Blob([buildStoreZip(files) as BlobPart], { type: 'application/zip' }))
}

function checkById(checks: PreflightCheck[], id: string) {
  return checks.find((check) => check.id === id)
}

describe('runPackagePreflight', () => {
  it('passes a valid package and exposes the parsed metadata for preview', async () => {
    const result = await preflight([
      { path: 'SKILL.md', content: VALID_SKILL_MD },
      { path: 'README.md', content: '# demo' },
    ])

    expect(result.state).toBe('ready')
    expect(result.blocked).toBe(false)
    expect(result.metadata).toEqual({
      name: 'memory-keeper',
      description: '保存并整理会话记忆，支持按项目归档。',
      version: '1.2.0',
    })
    expect(result.checks.map((check) => check.passed)).toEqual([true, true, true])
  })

  it('unwraps a nested-only SKILL.md directory like the backend promotion step', async () => {
    const result = await preflight([
      { path: 'docs/SKILL.md', content: VALID_SKILL_MD },
      { path: 'docs/README.md', content: '# demo' },
    ])

    expect(result.blocked).toBe(false)
    expect(result.metadata.name).toBe('memory-keeper')
  })

  it('blocks a package without any SKILL.md after normalization', async () => {
    const result = await preflight([
      { path: 'README.md', content: '# demo' },
      { path: 'scripts/run.py', content: 'print(1)' },
    ])

    expect(result.blocked).toBe(true)
    const skillMdCheck = checkById(result.checks, 'skillMd')
    expect(skillMdCheck?.passed).toBe(false)
    expect(skillMdCheck?.failure?.messageKey).toBe('publish.preflight.skillMdMissing')
    expect(result.metadata.name).toBeUndefined()
  })

  it('unwraps a single root directory exactly like the backend extractor', async () => {
    const result = await preflight([
      { path: 'my-skill/SKILL.md', content: VALID_SKILL_MD },
      { path: 'my-skill/README.md', content: '# demo' },
    ])

    expect(result.blocked).toBe(false)
    expect(result.metadata.name).toBe('memory-keeper')
  })

  it('ignores macOS metadata junk entries', async () => {
    const result = await preflight([
      { path: '__MACOSX/my-skill/._SKILL.md', content: 'junk' },
      { path: 'my-skill/.DS_Store', content: 'junk' },
      { path: 'my-skill/SKILL.md', content: VALID_SKILL_MD },
    ])

    expect(result.blocked).toBe(false)
    expect(result.metadata.name).toBe('memory-keeper')
  })

  it('canonicalizes lower-case skill.md file names to SKILL.md', async () => {
    const result = await preflight([{ path: 'skill.md', content: VALID_SKILL_MD }])

    expect(result.blocked).toBe(false)
    expect(result.metadata.name).toBe('memory-keeper')
  })

  it('blocks when several directories each contain a SKILL.md', async () => {
    const result = await preflight([
      { path: 'alpha/SKILL.md', content: VALID_SKILL_MD },
      { path: 'beta/SKILL.md', content: VALID_SKILL_MD },
    ])

    expect(result.blocked).toBe(true)
    expect(checkById(result.checks, 'skillMd')?.failure?.messageKey).toBe('publish.preflight.skillMdAmbiguous')
  })

  it('blocks a missing name field with a specific message', async () => {
    const result = await preflight([{ path: 'SKILL.md', content: '---\ndescription: has description\n---\n' }])

    expect(result.blocked).toBe(true)
    const nameCheck = checkById(result.checks, 'name')
    expect(nameCheck?.passed).toBe(false)
    expect(nameCheck?.failure?.messageKey).toBe('publish.preflight.nameMissing')
    expect(checkById(result.checks, 'description')?.passed).toBe(true)
  })

  it('blocks reserved or malformed names after slugification', async () => {
    const reserved = await preflight([{ path: 'SKILL.md', content: skillMdContent('admin', 'desc') }])
    expect(checkById(reserved.checks, 'name')?.failure).toMatchObject({
      messageKey: 'publish.preflight.nameInvalidReserved',
      params: { slug: 'admin' },
    })

    const short = await preflight([{ path: 'SKILL.md', content: skillMdContent('a', 'desc') }])
    expect(checkById(short.checks, 'name')?.failure?.messageKey).toBe('publish.preflight.nameInvalidLength')

    const symbols = await preflight([{ path: 'SKILL.md', content: skillMdContent('!!!', 'desc') }])
    expect(checkById(symbols.checks, 'name')?.failure?.messageKey).toBe('publish.preflight.nameInvalidPattern')
  })

  it('blocks an absent description with the guidance message', async () => {
    const result = await preflight([{ path: 'SKILL.md', content: '---\nname: valid-name\n---\n' }])

    expect(result.blocked).toBe(true)
    const descriptionCheck = checkById(result.checks, 'description')
    expect(descriptionCheck?.passed).toBe(false)
    expect(descriptionCheck?.failure?.messageKey).toBe('publish.preflight.descriptionMissing')
  })

  it('blocks a blank description with the same guidance message', async () => {
    const result = await preflight([
      { path: 'SKILL.md', content: '---\nname: valid-name\ndescription: "   "\n---\n' },
    ])

    expect(result.blocked).toBe(true)
    expect(checkById(result.checks, 'description')?.failure?.messageKey).toBe('publish.preflight.descriptionMissing')
  })

  it('blocks malformed frontmatter and skips name/description rows', async () => {
    const result = await preflight([{ path: 'SKILL.md', content: 'name: no-frontmatter\n' }])

    expect(result.blocked).toBe(true)
    expect(checkById(result.checks, 'skillMd')?.passed).toBe(true)
    expect(checkById(result.checks, 'frontmatter')?.failure?.messageKey).toBe('publish.preflight.frontmatterInvalid')
    expect(result.checks.some((check) => check.id === 'name')).toBe(false)
  })

  it('reads the version from nested metadata.version when top-level version is absent', async () => {
    const result = await preflight([
      { path: 'SKILL.md', content: '---\nname: nested-v\ndescription: d\nmetadata:\n  version: 3.1.4\n---\n' },
    ])

    expect(result.blocked).toBe(false)
    expect(result.metadata.version).toBe('3.1.4')
  })

  it('blocks paths the official extractor is guaranteed to reject', async () => {
    for (const badPath of ['./SKILL.md', 'docs//SKILL.md', 'a/../SKILL.md', 'C:SKILL.md']) {
      const result = await preflight([{ path: badPath, content: VALID_SKILL_MD }])

      expect(result.blocked, `expected ${badPath} to be blocked`).toBe(true)
      const pathsCheck = checkById(result.checks, 'paths')
      expect(pathsCheck?.passed).toBe(false)
      expect(pathsCheck?.failure?.messageKey).toBe('publish.preflight.pathInvalid')
      expect(result.metadata.name).toBeUndefined()
    }
  })

  it('blocks a package when any entry has a path the server rejects', async () => {
    const result = await preflight([
      { path: 'SKILL.md', content: VALID_SKILL_MD },
      { path: 'scripts//run.py', content: 'print(1)' },
    ])

    expect(result.blocked).toBe(true)
    expect(checkById(result.checks, 'paths')?.failure?.messageKey).toBe('publish.preflight.pathInvalid')
  })

  it('reports a non-zip payload as a blocking read failure', async () => {
    const result = await runPackagePreflight(new Blob(['not a zip at all']))

    expect(result.state).toBe('ready')
    expect(result.blocked).toBe(true)
    expect(result.failure?.messageKey).toBe('publish.preflight.zipUnreadable')
    expect(result.checks).toEqual([])
  })

  it('keeps unsupported-but-zip payloads unblocked and leaves validation to the server', async () => {
    const result = await runPackagePreflight(
      new Blob([buildStoreZip([
        { path: 'SKILL.md', content: VALID_SKILL_MD, encrypted: true },
      ]) as BlobPart]),
    )

    expect(result.state).toBe('unreadable')
    expect(result.blocked).toBe(false)
  })

  it('works with File inputs used by the upload zone', async () => {
    const file = makeZipFile([{ path: 'SKILL.md', content: VALID_SKILL_MD }], 'memory-keeper.zip', 5)
    const result = await runPackagePreflight(file)

    expect(result.blocked).toBe(false)
    expect(result.metadata.name).toBe('memory-keeper')
  })
})
