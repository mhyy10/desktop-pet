import type { PetTheme } from './types'
import { SKINS as BUILTIN_SKINS, type SkinDefinition, type SkinId } from './theme'

// ============================================
// 皮肤注册中心
// 统一管理内置皮肤 + 用户自定义皮肤
// 所有消费方（设置面板/渲染器/缓存）都从此查询，消除硬编码 SkinId union
// ============================================

/** 内置皮肤（运行时不可变） */
export type BuiltInSkin = SkinDefinition & { isBuiltIn: true }

/** 用户自定义皮肤（不继承 SkinDefinition，因为 id 是 string 而非 SkinId union） */
export interface CustomSkin {
  /** 'custom_' + uuid，保证唯一 */
  id: string
  name: string
  icon: string
  description: string
  theme: PetTheme
  isBuiltIn: false
  /** 创建时间戳 */
  createdAt: number
  /** 更新时间戳 */
  updatedAt: number
  /** 来源：手动新建 / 导入 */
  source: 'manual' | 'imported'
}

/** 注册表中的皮肤 */
export type RegisteredSkin = BuiltInSkin | CustomSkin

const registry = new Map<string, RegisteredSkin>()
let initialized = false

/** 标记一个 id 是否为内置皮肤（id 即 SkinId 字面量） */
function isBuiltInId(id: string): id is SkinId {
  return BUILTIN_SKINS.some((s) => s.id === id)
}

/** 启动时注册内置皮肤（幂等） */
export function initSkinRegistry(): void {
  if (initialized) return
  for (const skin of BUILTIN_SKINS) {
    registry.set(skin.id, { ...skin, isBuiltIn: true })
  }
  initialized = true
}

/** 注册一个自定义皮肤（覆盖同 id） */
export function registerCustomSkin(skin: CustomSkin): void {
  if (isBuiltInId(skin.id)) {
    throw new Error(`[skinRegistry] 不能用内置皮肤 id 注册自定义皮肤: ${skin.id}`)
  }
  registry.set(skin.id, skin)
}

/** 注销一个自定义皮肤（内置皮肤不可注销） */
export function unregisterCustomSkin(id: string): boolean {
  if (isBuiltInId(id)) return false
  return registry.delete(id)
}

/** 获取所有已注册皮肤（内置在前，自定义按创建时间在后） */
export function getAllSkins(): RegisteredSkin[] {
  const builtins: RegisteredSkin[] = []
  const customs: CustomSkin[] = []
  for (const skin of registry.values()) {
    if (skin.isBuiltIn) builtins.push(skin)
    else customs.push(skin)
  }
  customs.sort((a, b) => a.createdAt - b.createdAt)
  return [...builtins, ...customs]
}

/** 按 id 获取皮肤 */
export function getSkinById(id: string): RegisteredSkin | undefined {
  return registry.get(id)
}

/** 按 id 获取主题配色（替代 getThemeBySkin，支持自定义皮肤） */
export function getThemeById(id: string): PetTheme {
  return registry.get(id)?.theme ?? BUILTIN_SKINS[0].theme
}

/** 是否为内置皮肤 */
export function isBuiltInSkin(id: string): boolean {
  return isBuiltInId(id)
}

/** 重置注册表（仅测试用） */
export function _resetRegistryForTest(): void {
  registry.clear()
  initialized = false
}
