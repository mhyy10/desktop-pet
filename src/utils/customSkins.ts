import type { CustomSkin } from '../pet/skinRegistry'
import type { PetTheme } from '../pet/types'

// ============================================
// 自定义皮肤持久化（localStorage）
// 皮肤数据极小（8 个 hex 字符串），用 localStorage 足够
// ============================================

const CUSTOM_SKINS_KEY = 'pet_custom_skins'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // quota exceeded etc.
  }
}

/** 生成自定义皮肤 id */
export function generateCustomSkinId(): string {
  return 'custom_' + crypto.randomUUID()
}

/** 从主题+元信息构造一个 CustomSkin（手动新建）。深拷贝 theme，避免与调用方共享引用。 */
export function createCustomSkin(
  name: string,
  icon: string,
  description: string,
  theme: PetTheme
): CustomSkin {
  const now = Date.now()
  return {
    id: generateCustomSkinId(),
    name,
    icon,
    description,
    theme: { ...theme },
    isBuiltIn: false,
    createdAt: now,
    updatedAt: now,
    source: 'manual',
  }
}

/** 读取全部自定义皮肤 */
export function loadCustomSkins(): CustomSkin[] {
  return read<CustomSkin[]>(CUSTOM_SKINS_KEY, [])
}

/** 保存全部自定义皮肤（全量覆盖） */
export function saveCustomSkins(skins: CustomSkin[]): void {
  write(CUSTOM_SKINS_KEY, skins)
}

/** 新增一个自定义皮肤，返回新列表 */
export function addCustomSkin(skin: CustomSkin): CustomSkin[] {
  const skins = loadCustomSkins()
  skins.push(skin)
  saveCustomSkins(skins)
  return skins
}

/** 删除一个自定义皮肤，返回新列表 */
export function deleteCustomSkin(id: string): CustomSkin[] {
  const skins = loadCustomSkins().filter((s) => s.id !== id)
  saveCustomSkins(skins)
  return skins
}

/** 更新一个自定义皮肤（合并 patch，刷新 updatedAt），返回新列表 */
export function updateCustomSkin(id: string, patch: Partial<Omit<CustomSkin, 'id' | 'isBuiltIn' | 'createdAt'>>): CustomSkin[] {
  const skins = loadCustomSkins().map((s) =>
    s.id === id
      ? { ...s, ...patch, updatedAt: Date.now() }
      : s
  )
  saveCustomSkins(skins)
  return skins
}
