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

  it('keeps the landing quick-start focused on agent and user tabs', () => {
    expect(zh.landing.quickStart.tabs).toEqual({ agent: '我是智能体', human: '我是用户' })
    expect(en.landing.quickStart.tabs).toEqual({ agent: 'I am an Agent', human: 'I am a User' })
    expect(zh.landing.quickStart.human.command).toContain('npx clawhub')
    expect(zh.landing.quickStart.human.command).toContain('--registry')
    expect(en.landing.quickStart.human.command).toContain('npx clawhub')
    expect(en.landing.quickStart.human.command).toContain('--registry')
  })
})
