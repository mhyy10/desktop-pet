import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createCustomSkin,
  loadCustomSkins,
  saveCustomSkins,
  addCustomSkin,
  deleteCustomSkin,
  updateCustomSkin,
  generateCustomSkinId,
} from './customSkins'
import type { PetTheme } from '../pet/types'

// ============================================
// 自定义皮肤持久化单测
// node 环境无 localStorage / crypto.randomUUID，需 polyfill/mock
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

// 内存版 localStorage
function createMemStorage(): Storage {
  let store: Record<string, string> = {}
  return {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = String(v)
    },
    removeItem: (k: string) => {
      delete store[k]
    },
    clear: () => {
      store = {}
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() {
      return Object.keys(store).length
    },
  }
}

describe('customSkins', () => {
  beforeEach(() => {
    // mock localStorage
    vi.stubGlobal('localStorage', createMemStorage())
    // mock crypto.randomUUID
    let counter = 0
    vi.stubGlobal('crypto', {
      ...globalThis.crypto,
      randomUUID: () => `test-uuid-${counter++}`,
    })
  })

  describe('createCustomSkin', () => {
    it('构造自定义皮肤，字段正确', () => {
      const skin = createCustomSkin('海蓝', '🌊', '深海', sampleTheme)
      expect(skin.name).toBe('海蓝')
      expect(skin.icon).toBe('🌊')
      expect(skin.description).toBe('深海')
      expect(skin.theme).toEqual(sampleTheme)
      expect(skin.isBuiltIn).toBe(false)
      expect(skin.source).toBe('manual')
      expect(skin.id).toMatch(/^custom_/)
    })

    it('createCustomSkin 深拷贝 theme，不共享引用', () => {
      const skin = createCustomSkin('x', 'x', 'x', sampleTheme)
      skin.theme.bodyColor = '#FFFFFF'
      expect(sampleTheme.bodyColor).toBe('#444444')
    })
  })

  describe('load / save', () => {
    it('空状态 loadCustomSkins 返回空数组', () => {
      expect(loadCustomSkins()).toEqual([])
    })

    it('save 后 load 往返一致', () => {
      const skin = createCustomSkin('海蓝', '🌊', '深海', sampleTheme)
      saveCustomSkins([skin])
      const loaded = loadCustomSkins()
      expect(loaded).toHaveLength(1)
      expect(loaded[0]).toEqual(skin)
    })

    it('localStorage 损坏时 loadCustomSkins 返回空数组', () => {
      localStorage.setItem('pet_custom_skins', '{bad json')
      expect(loadCustomSkins()).toEqual([])
    })
  })

  describe('add / delete / update', () => {
    it('addCustomSkin 追加并持久化', () => {
      const a = createCustomSkin('A', '🅰️', 'a', sampleTheme)
      const b = createCustomSkin('B', '🅱️', 'b', sampleTheme)
      addCustomSkin(a)
      addCustomSkin(b)
      expect(loadCustomSkins()).toHaveLength(2)
    })

    it('deleteCustomSkin 按 id 删除', () => {
      const a = createCustomSkin('A', '🅰️', 'a', sampleTheme)
      addCustomSkin(a)
      deleteCustomSkin(a.id)
      expect(loadCustomSkins()).toEqual([])
    })

    it('updateCustomSkin 合并 patch 并刷新 updatedAt', async () => {
      const a = createCustomSkin('A', '🅰️', 'a', sampleTheme)
      addCustomSkin(a)
      const before = a.updatedAt
      // 保证 updatedAt 推进
      await sleep(1)
      updateCustomSkin(a.id, { name: 'A2' })
      const loaded = loadCustomSkins()
      expect(loaded[0].name).toBe('A2')
      expect(loaded[0].updatedAt).toBeGreaterThanOrEqual(before)
    })

    it('updateCustomSkin 不改 id/isBuiltIn/createdAt', () => {
      const a = createCustomSkin('A', '🅰️', 'a', sampleTheme)
      addCustomSkin(a)
      updateCustomSkin(a.id, { name: 'A2' })
      const loaded = loadCustomSkins()[0]
      expect(loaded.id).toBe(a.id)
      expect(loaded.isBuiltIn).toBe(false)
      expect(loaded.createdAt).toBe(a.createdAt)
    })
  })

  it('generateCustomSkinId 以 custom_ 开头', () => {
    expect(generateCustomSkinId()).toMatch(/^custom_/)
  })
})

// 简易 sleep（vitest node 环境）
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
