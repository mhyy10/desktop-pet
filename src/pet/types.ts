// ============================================
// 宠物类型定义
// ============================================

/** 宠物表情状态 */
export type PetMood =
  | 'happy'     // 开心 (^^)
  | 'idle'      // 平静 (..)
  | 'bored'     // 无聊 (-_-)
  | 'sleeping'  // 打盹 (--) zzZ
  | 'excited'   // 兴奋 (*o*)
  | 'shy'       // 害羞 (⁄⁄>⁄▽⁄<⁄⁄)
  | 'angry'     // 生气 (╬Ò﹏Ó)
  | 'thinking'  // 思考 (•̀ω•́)
  | 'surprised' // 惊讶 (!o!)

/** 宠物行为 */
export type PetAction =
  | 'idle_stand'   // 站立发呆
  | 'idle_breathe' // 呼吸微动
  | 'walk_left'    // 向左走
  | 'walk_right'   // 向右走
  | 'bounce'       // 弹跳
  | 'sleep'        // 打盹
  | 'wave'         // 挥手
  | 'think'        // 思考
  | 'eat'          // 吃东西
  | 'play'         // 玩耍

/** 宠物位置（屏幕坐标） */
export interface PetPosition {
  x: number
  y: number
}

/** 宠物状态 */
export interface PetState {
  mood: PetMood
  action: PetAction
  position: PetPosition
  scale: number
  lastInteractionTime: number
  isDragging: boolean
  isChatOpen: boolean
}

/** 粒子类型 */
export type ParticleType = 'star' | 'heart' | 'zzz' | 'sparkle' | 'note' | 'drop'

/** 粒子实例 */
export interface Particle {
  id: number
  type: ParticleType
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  opacity: number
  rotation: number
  rotationSpeed: number
  color: string
}

/** 动画帧 */
export interface AnimationFrame {
  spriteIndex: number
  duration: number // ms
}

/** 动画定义 */
export interface Animation {
  name: PetAction
  frames: AnimationFrame[]
  loop: boolean
}

/** 主题色系 */
export interface PetTheme {
  primary: string
  secondary: string
  warm: string
  cool: string
  bodyColor: string
  glowColor: string
  eyeColor: string
  cheekColor: string
}

/** 对话消息 */
export interface ChatMessage {
  id: string
  role: 'user' | 'pet'
  content: string
  timestamp: number
}
