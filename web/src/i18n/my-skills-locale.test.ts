import { describe, expect, it } from 'vitest'
import en from './locales/en.json'
import zh from './locales/zh.json'

describe('My Skills category filter locale', () => {
  it('defines matching English and Simplified Chinese category and error copy', () => {
    expect(en.mySkills.categoryFilterLabel).toBe('Filter by category')
    expect(en.mySkills.categoryFilterAll).toBe('All categories')
    expect(en.mySkills.loadError).toBe('Failed to load filtered skills. Please try again later.')

    expect(zh.mySkills.categoryFilterLabel).toBe('按分类过滤')
    expect(zh.mySkills.categoryFilterAll).toBe('全部分类')
    expect(zh.mySkills.loadError).toBe('筛选后的技能加载失败，请稍后重试')
  })
})
