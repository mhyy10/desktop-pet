import type { PetAction } from './types'
import type { SpriteAnimation } from './SpriteGenerator'

// ============================================
// 动画帧播放控制器
// 管理 action → frames 映射，帧率，循环
// ============================================

export class AnimationController {
  /** 所有动作的动画定义 */
  private animations: Map<PetAction, SpriteAnimation>
  /** 当前播放的动作 */
  private currentAction: PetAction = 'idle_stand'
  /** 当前帧索引（在当前动画的 frames 数组中） */
  private currentFrameIndex: number = 0
  /** 当前帧已播放时间 (ms) */
  private frameElapsed: number = 0
  /** 是否已完成（非循环动画用） */
  private _isFinished: boolean = false

  constructor(animations: Map<PetAction, SpriteAnimation>) {
    this.animations = animations
  }

  /** 切换到指定动作 */
  play(action: PetAction) {
    if (this.currentAction === action) return
    this.currentAction = action
    this.currentFrameIndex = 0
    this.frameElapsed = 0
    this._isFinished = false
  }

  /** 每帧 tick，返回当前帧索引和动作 */
  tick(deltaMs: number): { frameIndex: number; action: PetAction } {
    const anim = this.animations.get(this.currentAction)
    if (!anim || anim.frames.length === 0) {
      return { frameIndex: 0, action: this.currentAction }
    }

    // 如果动画已结束且不循环
    if (this._isFinished) {
      return {
        frameIndex: this.currentFrameIndex,
        action: this.currentAction,
      }
    }

    this.frameElapsed += deltaMs

    // 检查是否需要切换帧
    const frameDuration = anim.frameDuration
    while (this.frameElapsed >= frameDuration) {
      this.frameElapsed -= frameDuration
      this.currentFrameIndex++

      // 到达动画末尾
      if (this.currentFrameIndex >= anim.frames.length) {
        if (anim.loop) {
          this.currentFrameIndex = 0
        } else {
          this.currentFrameIndex = anim.frames.length - 1
          this._isFinished = true
          break
        }
      }
    }

    return {
      frameIndex: this.currentFrameIndex,
      action: this.currentAction,
    }
  }

  /** 获取当前动作 */
  get action(): PetAction {
    return this.currentAction
  }

  get currentFrame(): number {
    return this.currentFrameIndex
  }

  get isFinished(): boolean {
    return this._isFinished
  }

  /** 获取某动作的总帧数 */
  getFrameCount(action: PetAction): number {
    return this.animations.get(action)?.frames.length ?? 0
  }

  /** 获取某动作的帧持续时间 */
  getFrameDuration(action: PetAction): number {
    return this.animations.get(action)?.frameDuration ?? 200
  }

  /** 从 SpriteAnimation 列表构建 Map */
  static fromArray(anims: SpriteAnimation[]): Map<PetAction, SpriteAnimation> {
    const map = new Map<PetAction, SpriteAnimation>()
    for (const a of anims) {
      map.set(a.action, a)
    }
    return map
  }
}
