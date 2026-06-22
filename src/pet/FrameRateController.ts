import type { PetAction } from './types'

// ============================================
// 智能帧率控制器
// 根据宠物状态动态调整渲染帧率
// 交互60fps / 活跃30fps / 空闲12fps / 睡觉6fps / 不可见0fps
// ============================================

/** 帧率策略映射 */
const FPS_MAP: Record<string, number> = {
  bounce: 30,
  walk_left: 30,
  walk_right: 30,
  play: 30,
  wave: 30,
  idle_stand: 12,
  idle_breathe: 12,
  think: 12,
  eat: 12,
  sleep: 6,
}

/** 拖拽/对话时的帧率 */
const INTERACTION_FPS = 60

/** 不可见时的帧率 */
const HIDDEN_FPS = 0

export class FrameRateController {
  private lastFrameTime: number = 0
  private isVisible: boolean = true

  /** 计算当前目标帧率 */
  getTargetFps(action: PetAction, isDragging: boolean, isChatOpen: boolean): number {
    if (!this.isVisible) return HIDDEN_FPS
    if (isDragging || isChatOpen) return INTERACTION_FPS
    return FPS_MAP[action] ?? 12
  }

  /** 计算帧间隔（ms） */
  getFrameInterval(action: PetAction, isDragging: boolean, isChatOpen: boolean): number {
    const fps = this.getTargetFps(action, isDragging, isChatOpen)
    if (fps <= 0) return Infinity
    return 1000 / fps
  }

  /** 判断当前是否应该渲染一帧 */
  shouldRender(now: number, action: PetAction, isDragging: boolean, isChatOpen: boolean): boolean {
    const fps = this.getTargetFps(action, isDragging, isChatOpen)
    if (fps <= 0) return false

    const interval = 1000 / fps
    if (now - this.lastFrameTime >= interval) {
      this.lastFrameTime = now
      return true
    }
    return false
  }

  /** 更新可见性 */
  setVisible(visible: boolean): void {
    this.isVisible = visible
  }

  /** 重置帧计时（切换状态后调用，避免延迟） */
  reset(): void {
    this.lastFrameTime = performance.now()
  }
}
