import { describe, it, expect, beforeEach } from 'vitest'
import {
  initSkinRegistry,
  registerCustomSkin,
  unregisterCustomSkin,
  getAllSkins,
  getSkinById,
  getThemeById,
  isBuiltInSkin,
  _resetRegistryForTest,
} from './skinRegistry'
import { createCustomSkin } from '../utils/customSkins'
import type { PetTheme } from './types'

// ============================================
// 皮肤注册中心单测
// ============================================

const sampleTheme: PetTheme = {
  primary: '#000000',
  secondary: '#111111',
  warm: '#222222',
  cool: '#333333',
  bodyColor: '#444444',
  glowColor: '#555555',
  eyeColor: '#666666',
  cheekColor: '#777777',
}

describe('skinRegistry', () => {
  beforeEach(() => {
    _resetRegistryForTest()
    initSkinRegistry()
  })

  describe('内置皮肤', () => {
    it('初始化后注册 4 个内置皮肤', () => {
      const skins = getAllSkins()
      expect(skins).toHaveLength(4)
      expect(skins.every((s) => s.isBuiltIn)).toBe(true)
    })

    it('initSkinRegistry 幂等，重复调用不重复注册', () => {
      initSkinRegistry()
      initSkinRegistry()
      expect(getAllSkins()).toHaveLength(4)
    })

    it('getSkinById 查内置皮肤', () => {
      const lumie = getSkinById('lumie')
      expect(lumie).toBeDefined()
      expect(lumie!.name).toBe('小光')
      expect(lumie!.isBuiltIn).toBe(true)
    })

    it('getThemeById 返回内置皮肤主题', () => {
      const theme = getThemeById('lumie')
      expect(theme.bodyColor).toBe('#A29BFE')
    })

    it('getThemeById 未知 id 回退到默认主题', () => {
      const theme = getThemeById('not-exist')
      expect(theme.bodyColor).toBe('#A29BFE')
    })

    it('isBuiltInSkin 内置返回 true', () => {
      expect(isBuiltInSkin('lumie')).toBe(true)
      expect(isBuiltInSkin('robot')).toBe(true)
    })
  })

  describe('自定义皮肤', () => {
    it('registerCustomSkin 注册后可查询', () => {
      const skin = createCustomSkin('测试', '🧪', 'desc', sampleTheme)
      registerCustomSkin(skin)
      expect(getSkinById(skin.id)).toBeDefined()
      expect(getSkinById(skin.id)!.isBuiltIn).toBe(false)
      expect(getThemeById(skin.id)).toEqual(sampleTheme)
    })

    it('getAllSkins 内置在前，自定义在后', () => {
      const skin = createCustomSkin('测试', '🧪', 'desc', sampleTheme)
      registerCustomSkin(skin)
      const all = getAllSkins()
      expect(all).toHaveLength(5)
      expect(all[0].isBuiltIn).toBe(true)
      expect(all[4].isBuiltIn).toBe(false)
    })

    it('不能用内置皮肤 id 注册自定义皮肤', () => {
      const skin = { ...createCustomSkin('测试', '🧪', 'desc', sampleTheme), id: 'lumie' }
      expect(() => registerCustomSkin(skin)).toThrow()
    })

    it('unregisterCustomSkin 删除自定义皮肤', () => {
      const skin = createCustomSkin('测试', '🧪', 'desc', sampleTheme)
      registerCustomSkin(skin)
      expect(unregisterCustomSkin(skin.id)).toBe(true)
      expect(getSkinById(skin.id)).toBeUndefined()
    })

    it('unregisterCustomSkin 不能删除内置皮肤', () => {
      expect(unregisterCustomSkin('lumie')).toBe(false)
      expect(getSkinById('lumie')).toBeDefined()
    })

    it('isBuiltInSkin 自定义皮肤返回 false', () => {
      const skin = createCustomSkin('测试', '🧪', 'desc', sampleTheme)
      registerCustomSkin(skin)
      expect(isBuiltInSkin(skin.id)).toBe(false)
    })
  })
})
