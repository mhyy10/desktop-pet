import type { PetTheme } from './types'

// ============================================
// 皮肤主题集合
// 每个皮肤定义完整的 PetTheme 配色
// ============================================

export type SkinId = 'lumie' | 'eggy' | 'blackcat' | 'robot'

export interface SkinDefinition {
  id: SkinId
  name: string
  icon: string
  description: string
  theme: PetTheme
}

export const SKINS: SkinDefinition[] = [
  {
    id: 'lumie',
    name: '小光',
    icon: '✨',
    description: '微光紫精灵，温暖好奇',
    theme: {
      primary: '#6C5CE7',
      secondary: '#00B894',
      warm: '#FDCB6E',
      cool: '#74B9FF',
      bodyColor: '#A29BFE',
      glowColor: '#6C5CE7',
      eyeColor: '#2D3436',
      cheekColor: '#FD79A8',
    },
  },
  {
    id: 'eggy',
    name: '煎蛋仔',
    icon: '🍳',
    description: '圆滚滚的小煎蛋，有点呆萌',
    theme: {
      primary: '#FDCB6E',
      secondary: '#E17055',
      warm: '#FFEAA7',
      cool: '#DFE6E9',
      bodyColor: '#FFEAA7',
      glowColor: '#FDCB6E',
      eyeColor: '#2D3436',
      cheekColor: '#FAB1A0',
    },
  },
  {
    id: 'blackcat',
    name: '黑猫',
    icon: '🐱',
    description: '神秘的黑色猫咪，高冷傲娇',
    theme: {
      primary: '#2D3436',
      secondary: '#A29BFE',
      warm: '#FD79A8',
      cool: '#636E72',
      bodyColor: '#2D3436',
      glowColor: '#A29BFE',
      eyeColor: '#00B894',
      cheekColor: '#636E72',
    },
  },
  {
    id: 'robot',
    name: '机器人',
    icon: '🤖',
    description: '金属质感的小机器人，科技感十足',
    theme: {
      primary: '#0984E3',
      secondary: '#00CEC9',
      warm: '#74B9FF',
      cool: '#636E72',
      bodyColor: '#636E72',
      glowColor: '#0984E3',
      eyeColor: '#00CEC9',
      cheekColor: '#0984E3',
    },
  },
]

/** 默认主题（小光） */
export const defaultTheme: PetTheme = SKINS[0].theme

/** 默认皮肤 id（小光） */
export const defaultSkinId: SkinId = SKINS[0].id

/**
 * 根据 skinId 获取主题（仅查询内置皮肤）
 * 注意：自定义皮肤请用 skinRegistry.getThemeById，本函数对未知 id 返回 defaultTheme。
 * 保留此函数以向后兼容；新代码应优先使用 getThemeById。
 */
export function getThemeBySkin(skinId: SkinId): PetTheme {
  return SKINS.find((s) => s.id === skinId)?.theme ?? defaultTheme
}
