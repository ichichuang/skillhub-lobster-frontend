import { afterEach, describe, expect, it } from 'vitest'
import { execFile } from 'node:child_process'
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const webRoot = path.resolve(scriptDirectory, '..')
const temporaryDirectories = []
const publicBaseUrl = 'http://10.100.5.133/skillhub'

async function createTemporaryDirectory(prefix) {
  const directory = await mkdtemp(path.join(tmpdir(), prefix))
  temporaryDirectories.push(directory)
  return directory
}

async function writeFixture(filePath, content) {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, content, 'utf8')
}

async function createVerifierArtifact(overrides = {}) {
  const artifact = await createTemporaryDirectory('skillhub-verify-')
  const files = {
    'index.html': '<div id="root"></div><div id="skillhub-portals"></div><script src="/skillhub/assets/main.js"></script>',
    'assets/main.js': 'console.info("fixture")',
    'runtime-config.js': `window.__SKILLHUB_RUNTIME_CONFIG__ = { appBaseUrl: ${JSON.stringify(publicBaseUrl)} }`,
    'registry/skill.md': `# SkillHub Registry\n\nUse --registry ${publicBaseUrl}\n`,
    ...overrides,
  }

  await Promise.all(Object.entries(files).map(([relativePath, content]) => (
    content === null ? Promise.resolve() : writeFixture(path.join(artifact, relativePath), content)
  )))
  return artifact
}

async function verifyArtifact(artifact) {
  return execFileAsync(process.execPath, [
    path.join(scriptDirectory, 'verify-dist-contract.mjs'),
    artifact,
    '--resolved',
  ])
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })))
})

describe('static deployment packaging', () => {
  it('renders the registry guide and runtime config from the canonical appBaseUrl', async () => {
    const fixtureRoot = await createTemporaryDirectory('skillhub-package-')
    const fixtureWebRoot = path.join(fixtureRoot, 'web')
    await mkdir(path.join(fixtureWebRoot, 'scripts'), { recursive: true })
    await cp(path.join(scriptDirectory, 'render-static-deployment.mjs'), path.join(fixtureWebRoot, 'scripts/render-static-deployment.mjs'))
    await cp(path.join(webRoot, 'base-path-config.ts'), path.join(fixtureWebRoot, 'base-path-config.ts'))
    await writeFixture(
      path.join(fixtureWebRoot, 'dist/index.html'),
      '<div id="root"></div><div id="skillhub-portals"></div><script src="/__SKILLHUB_WEB_BASE_PATH__/assets/main.js"></script>',
    )
    await writeFixture(path.join(fixtureWebRoot, 'dist/assets/main.js'), 'const base = "/__SKILLHUB_WEB_BASE_PATH__/"')
    await writeFixture(
      path.join(fixtureWebRoot, 'dist/runtime-config.js'),
      "window.__SKILLHUB_RUNTIME_CONFIG__ = { apiBaseUrl: '', appBaseUrl: '' }",
    )
    await cp(
      path.join(webRoot, 'src/docs/skill.md.template'),
      path.join(fixtureWebRoot, 'src/docs/skill.md.template'),
    )
    const template = await readFile(path.join(fixtureWebRoot, 'src/docs/skill.md.template'), 'utf8')
    expect(template).toContain('${SKILLHUB_PUBLIC_BASE_URL}')
    await writeFixture(
      path.join(fixtureWebRoot, 'deploy.json'),
      JSON.stringify({ appBaseUrl: publicBaseUrl, output: 'dist-static', webBasePath: '/skillhub/' }),
    )

    await execFileAsync(process.execPath, [
      path.join(fixtureWebRoot, 'scripts/render-static-deployment.mjs'),
      '--config',
      'deploy.json',
    ], { cwd: fixtureWebRoot })

    const guide = await readFile(path.join(fixtureWebRoot, 'dist-static/registry/skill.md'), 'utf8')
    const runtimeConfig = await readFile(path.join(fixtureWebRoot, 'dist-static/runtime-config.js'), 'utf8')
    expect(guide).toContain('name: skillhub-registry')
    expect(guide).toContain('技能注册中心')
    expect(guide).toContain('ClawHub')
    expect(guide).toContain('OpenClaw')
    expect(guide).toContain('SKILL.md')
    expect(guide).toContain('YAML')
    expect(guide).toContain('YAML 头部元数据')
    expect(guide).toContain('HTTP')
    expect(guide).toContain('API')
    expect(guide).toContain('终端/Exec')
    expect(guide).toContain('规范标识')
    expect(guide).toContain('本流程不要求自动发现')
    expect(guide).not.toContain('well-known 自动发现')
    expect(guide).toContain('@{namespace}/{skill_slug}')
    expect(guide).toContain('NAMESPACE_ONLY')
    expect(guide).toContain('PRIVATE')
    for (const command of [
      `npx clawhub search email --registry ${publicBaseUrl}`,
      `npx clawhub search "" --registry ${publicBaseUrl}`,
      `npx clawhub info my-skill --registry ${publicBaseUrl}`,
      `npx clawhub info team-name--my-skill --registry ${publicBaseUrl}`,
      `npx clawhub install my-skill --registry ${publicBaseUrl}`,
      `npx clawhub install my-skill@1.2.0 --registry ${publicBaseUrl}`,
      `npx clawhub install team-name--my-skill --registry ${publicBaseUrl}`,
      `npx clawhub publish ./my-skill --registry ${publicBaseUrl}`,
      `curl -fsSL ${publicBaseUrl}/registry/skill.md`,
      `npx clawhub --registry ${publicBaseUrl} login --token sk_your_api_token_here`,
    ]) {
      expect(guide).toContain(command)
    }
    expect(guide).toContain(publicBaseUrl)
    expect(guide).not.toContain('SkillHub')
    expect(guide).not.toContain('${SKILLHUB_PUBLIC_BASE_URL}')
    expect(runtimeConfig).toContain(`appBaseUrl: ${JSON.stringify(publicBaseUrl)}`)
  })

  it('rejects a deployment config without appBaseUrl', async () => {
    const fixtureRoot = await createTemporaryDirectory('skillhub-package-missing-base-')
    const fixtureWebRoot = path.join(fixtureRoot, 'web')
    await mkdir(path.join(fixtureWebRoot, 'scripts'), { recursive: true })
    await cp(path.join(scriptDirectory, 'render-static-deployment.mjs'), path.join(fixtureWebRoot, 'scripts/render-static-deployment.mjs'))
    await cp(path.join(webRoot, 'base-path-config.ts'), path.join(fixtureWebRoot, 'base-path-config.ts'))
    await writeFixture(path.join(fixtureWebRoot, 'deploy.json'), JSON.stringify({ output: 'dist-static', webBasePath: '/skillhub/' }))

    await expect(execFileAsync(process.execPath, [
      path.join(fixtureWebRoot, 'scripts/render-static-deployment.mjs'),
      '--config',
      'deploy.json',
    ], { cwd: fixtureWebRoot })).rejects.toMatchObject({
      stderr: expect.stringContaining('appBaseUrl'),
    })
  })
})

describe('resolved static deployment verification', () => {
  it('accepts a non-HTML guide containing the runtime public base URL', async () => {
    const artifact = await createVerifierArtifact()
    await expect(verifyArtifact(artifact)).resolves.toMatchObject({
      stdout: expect.stringContaining('Verified 4 deployment files'),
    })
  })

  it.each([
    ['a missing guide', { 'registry/skill.md': null }, 'missing registry/skill.md'],
    ['an empty guide', { 'registry/skill.md': '' }, 'registry/skill.md is empty'],
    ['SPA HTML content', { 'registry/skill.md': '<!doctype html><div id="root"></div>' }, 'must be Markdown/plain text'],
    ['generic HTML content', { 'registry/skill.md': '<p>Registry guide</p>' }, 'must be Markdown/plain text'],
    ['the wrong public base', { 'registry/skill.md': '# Guide\nUse --registry https://wrong.example.com/skillhub\n' }, 'does not contain the resolved public Registry base'],
    ['an unresolved public-base placeholder', { 'registry/skill.md': '# Guide\n${SKILLHUB_PUBLIC_BASE_URL}\n' }, 'unresolved public-base placeholder'],
  ])('rejects %s', async (_name, overrides, expectedError) => {
    const artifact = await createVerifierArtifact(overrides)

    await expect(verifyArtifact(artifact)).rejects.toMatchObject({
      stderr: expect.stringContaining(expectedError),
    })
  })
})
