import type { PetMood, PetAction, PetTheme } from './types'

// ============================================
// 统一渲染器接口
// PetRenderer / PixelRenderer 均实现此接口
// ============================================

export interface IRenderer {
  /** 异步初始化资源（如生成精灵图） */
  init(): Promise<void>

  /** 切换主题后重新初始化 */
  reinit(theme: PetTheme): Promise<void>

  /** 是否初始化完成 */
  readonly isReady: boolean

  /** 每帧更新（动画帧推进） */
  tick(deltaMs: number): void

  /** 主绘制入口 */
  draw(
    mood: PetMood,
    action: PetAction,
    centerX: number,
    centerY: number,
    timeMs: number,
    scale: number
  ): void
}

/** 渲染器类型标识 */
export type RendererType = 'pixel' | 'canvas'
