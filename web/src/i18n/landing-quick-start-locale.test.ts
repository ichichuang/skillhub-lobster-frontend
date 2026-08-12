import { describe, expect, it } from 'vitest'
import en from './locales/en.json'
import zh from './locales/zh.json'

describe('landing quick start locales', () => {
  it('uses terminal-first agent prompts with explicit registry commands in both locales', () => {
    for (const prompt of [
      zh.landing.quickStart.agent.command,
      zh.landing.quickStart.agent.commandTemplate,
      en.landing.quickStart.agent.command,
      en.landing.quickStart.agent.commandTemplate,
    ]) {
      expect(prompt).toMatch(/terminal|exec/i)
      expect(prompt).toMatch(/web-fetch/i)
      expect(prompt).toContain('curl')
      expect(prompt).toContain('npx clawhub')
      expect(prompt).toContain('--registry')
    }

    expect(zh.landing.quickStart.agent.commandTemplate).toContain('{{baseUrl}}')
    expect(en.landing.quickStart.agent.commandTemplate).toContain('{{baseUrl}}')
    expect(zh.landing.quickStart.agent.commandTemplate).toContain('{{guideUrl}}')
    expect(en.landing.quickStart.agent.commandTemplate).toContain('{{guideUrl}}')
  })

  it('exposes CLI install command in both locales', () => {
    expect(zh.landing.quickStart.tabs.cli).toBe('CLI')
    expect(zh.landing.quickStart.cli.command).toBe('npm i -g @astron-team/skillhub')
    expect(zh.landing.quickStart.cli.description).toBe('安装 SkillHub CLI 到本地，后续可运行 skillhub install 安装技能')
    expect(en.landing.quickStart.tabs.cli).toBe('CLI')
    expect(en.landing.quickStart.cli.command).toBe('npm i -g @astron-team/skillhub')
    expect(en.landing.quickStart.cli.description).toBe('Install the SkillHub CLI locally to run skillhub install for skills.')
  })
})
