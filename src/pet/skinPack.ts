import type { PetTheme } from './types'
import type { CustomSkin } from './skinRegistry'
import { generateCustomSkinId } from '../utils/customSkins'

// ============================================
// 皮肤包导入/导出（JSON 格式）
// 单个皮肤导出为 .json 文件，导入时校验并注册
// ============================================

/** 皮肤包格式版本 */
const SKIN_PACK_FORMAT = 'desktop-pet-skin'
const SKIN_PACK_VERSION = 1

/** 皮肤包 JSON 结构 */
export interface SkinPack {
  format: typeof SKIN_PACK_FORMAT
  version: number
  skin: {
    name: string
    icon: string
    description: string
    theme: PetTheme
  }
}

/** 合法 hex 颜色校验（#RRGGBB） */
const HEX_RE = /^#[0-9A-Fa-f]{6}$/

/** PetTheme 的全部字段 */
const THEME_FIELDS: (keyof PetTheme)[] = [
  'primary', 'secondary', 'warm', 'cool',
  'bodyColor', 'glowColor', 'eyeColor', 'cheekColor',
]

/** 校验一个值是否为合法 PetTheme */
export function isValidTheme(value: unknown): value is PetTheme {
  if (typeof value !== 'object' || value === null) return false
  const t = value as Record<string, unknown>
  for (const field of THEME_FIELDS) {
    if (typeof t[field] !== 'string' || !HEX_RE.test(t[field])) {
      return false
    }
  }
  return true
}

/** 校验一个值是否为合法皮肤包 */
export function isSkinPack(value: unknown): value is SkinPack {
  if (typeof value !== 'object' || value === null) return false
  const p = value as Record<string, unknown>
  if (p.format !== SKIN_PACK_FORMAT) return false
  if (typeof p.version !== 'number') return false
  if (typeof p.skin !== 'object' || p.skin === null) return false
  const s = p.skin as Record<string, unknown>
  if (typeof s.name !== 'string' || typeof s.icon !== 'string' || typeof s.description !== 'string') return false
  return isValidTheme(s.theme)
}

/** 序列化皮肤为皮肤包 JSON 字符串 */
export function serializeSkinPack(skin: { name: string; icon: string; description: string; theme: PetTheme }): string {
  const pack: SkinPack = {
    format: SKIN_PACK_FORMAT,
    version: SKIN_PACK_VERSION,
    skin: {
      name: skin.name,
      icon: skin.icon,
      description: skin.description,
      theme: skin.theme,
    },
  }
  return JSON.stringify(pack, null, 2)
}

/** 解析皮肤包 JSON 字符串，非法时抛错 */
export function parseSkinPack(json: string): SkinPack {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    throw new Error('皮肤包 JSON 解析失败')
  }
  if (!isSkinPack(data)) {
    throw new Error('皮肤包格式不合法（缺少字段或颜色值非法）')
  }
  return data
}

/**
 * 把皮肤包转成可注册的 CustomSkin
 * 始终生成新 id（导入时避免与已有皮肤冲突；若需覆盖请用 updateCustomSkin）
 */
export function skinPackToCustomSkin(pack: SkinPack): CustomSkin {
  const now = Date.now()
  return {
    id: generateCustomSkinId(),
    name: pack.skin.name,
    icon: pack.skin.icon,
    description: pack.skin.description,
    theme: pack.skin.theme,
    isBuiltIn: false,
    createdAt: now,
    updatedAt: now,
    source: 'imported',
  }
}

/** 下载皮肤包为 .json 文件（浏览器/Tauri webview 通用） */
export function downloadSkinPack(filename: string, json: string): void {
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.json') ? filename : `${filename}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
