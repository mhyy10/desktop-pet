import { describe, it, expect } from 'vitest'
import {
  serializeSkinPack,
  parseSkinPack,
  isSkinPack,
  isValidTheme,
  skinPackToCustomSkin,
} from './skinPack'
import type { PetTheme } from './types'

// ============================================
// 皮肤包导入/导出格式单测
// ============================================

const validTheme: PetTheme = {
  primary: '#6C5CE7',
  secondary: '#00B894',
  warm: '#FDCB6E',
  cool: '#74B9FF',
  bodyColor: '#A29BFE',
  glowColor: '#6C5CE7',
  eyeColor: '#2D3436',
  cheekColor: '#FD79A8',
}

describe('isValidTheme', () => {
  it('合法 PetTheme 返回 true', () => {
    expect(isValidTheme(validTheme)).toBe(true)
  })

  it('小写 hex 合法', () => {
    expect(isValidTheme({ ...validTheme, bodyColor: '#a29bfe' })).toBe(true)
  })

  it('缺字段返回 false', () => {
    const partial = { ...validTheme } as Record<string, unknown>
    delete partial.cheekColor
    expect(isValidTheme(partial)).toBe(false)
  })

  it('非 #RRGGBB 格式返回 false', () => {
    expect(isValidTheme({ ...validTheme, bodyColor: 'red' })).toBe(false)
    expect(isValidTheme({ ...validTheme, bodyColor: '#FFF' })).toBe(false)
    expect(isValidTheme({ ...validTheme, bodyColor: '#GGGGGG' })).toBe(false)
  })

  it('非对象返回 false', () => {
    expect(isValidTheme(null)).toBe(false)
    expect(isValidTheme('xxx')).toBe(false)
    expect(isValidTheme(123)).toBe(false)
  })
})

describe('serializeSkinPack / parseSkinPack', () => {
  it('序列化后能解析回来，字段一致', () => {
    const json = serializeSkinPack({ name: '海蓝', icon: '🌊', description: '深海蓝', theme: validTheme })
    const pack = parseSkinPack(json)
    expect(pack.format).toBe('desktop-pet-skin')
    expect(pack.version).toBe(1)
    expect(pack.skin.name).toBe('海蓝')
    expect(pack.skin.theme).toEqual(validTheme)
  })

  it('parseSkinPack 非法 JSON 抛错', () => {
    expect(() => parseSkinPack('{not json')).toThrow()
  })

  it('parseSkinPack 格式不合法抛错', () => {
    expect(() => parseSkinPack(JSON.stringify({ foo: 'bar' }))).toThrow()
    expect(() => parseSkinPack(JSON.stringify({ format: 'other', version: 1, skin: {} }))).toThrow()
  })

  it('parseSkinPack 颜色非法抛错', () => {
    const pack = { format: 'desktop-pet-skin', version: 1, skin: { name: 'x', icon: 'x', description: 'x', theme: { ...validTheme, bodyColor: 'bad' } } }
    expect(() => parseSkinPack(JSON.stringify(pack))).toThrow()
  })

  it('isSkinPack 合法返回 true', () => {
    const json = serializeSkinPack({ name: 'x', icon: 'x', description: 'x', theme: validTheme })
    expect(isSkinPack(JSON.parse(json))).toBe(true)
  })
})

describe('skinPackToCustomSkin', () => {
  it('转成 CustomSkin，字段一致，isBuiltIn=false，source=imported', () => {
    const pack = parseSkinPack(serializeSkinPack({ name: '海蓝', icon: '🌊', description: '深', theme: validTheme }))
    const skin = skinPackToCustomSkin(pack)
    expect(skin.name).toBe('海蓝')
    expect(skin.icon).toBe('🌊')
    expect(skin.theme).toEqual(validTheme)
    expect(skin.isBuiltIn).toBe(false)
    expect(skin.source).toBe('imported')
    expect(skin.id).toMatch(/^custom_/)
  })

  it('每次生成新 id', () => {
    const pack = parseSkinPack(serializeSkinPack({ name: 'x', icon: 'x', description: 'x', theme: validTheme }))
    const a = skinPackToCustomSkin(pack)
    const b = skinPackToCustomSkin(pack)
    expect(a.id).not.toBe(b.id)
  })
})
