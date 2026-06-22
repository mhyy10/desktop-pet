import type { PetTheme, PetAction } from './types'
import { FRAME_W, FRAME_H, COLS, flipHorizontal, type FrameParams } from './spriteUtils'
import { defineAnimations } from './SpriteAnimations'
import { SpriteDrawer } from './SpriteDrawer'

// ============================================
// 像素精灵生成器 — 编排层
// 组装 Sprite Sheet，依赖 SpriteDrawer + SpriteAnimations
// ============================================

/** 动画定义（帧序列 + 每帧持续时间） */
export interface SpriteAnimation {
  action: PetAction
  frames: FrameParams[]
  frameDuration: number
  loop: boolean
}

/** Sprite Sheet 生成结果 */
export interface SpriteSheet {
  canvas: HTMLCanvasElement
  frameRects: Map<PetAction, { col: number; row: number; w: number; h: number }[]>
  animations: Map<PetAction, SpriteAnimation>
  frameSize: { w: number; h: number }
}

export class SpriteGenerator {
  private drawer: SpriteDrawer

  constructor(theme: PetTheme) {
    this.drawer = new SpriteDrawer(theme)
  }

  /** 生成完整的 Sprite Sheet */
  generate(): SpriteSheet {
    const animations = defineAnimations()
    const allFrames: FrameParams[] = []
    const frameRects = new Map<PetAction, { col: number; row: number; w: number; h: number }[]>()

    const actionOrder: PetAction[] = [
      'idle_stand', 'idle_breathe', 'walk_left', 'bounce',
      'sleep', 'wave', 'think', 'eat', 'play',
    ]

    for (const action of actionOrder) {
      const anim = animations.get(action)!
      const rects: { col: number; row: number; w: number; h: number }[] = []
      for (let i = 0; i < anim.frames.length; i++) {
        const idx = allFrames.length
        rects.push({
          col: idx % COLS,
          row: Math.floor(idx / COLS),
          w: FRAME_W,
          h: FRAME_H,
        })
        allFrames.push(anim.frames[i])
      }
      frameRects.set(action, rects)
    }

    // walk_right: 从 walk_left 帧翻转生成独立帧
    const walkLeftAnim = animations.get('walk_left')!
    const walkRightRects: { col: number; row: number; w: number; h: number }[] = []
    const walkRightFrames: FrameParams[] = []

    for (let i = 0; i < walkLeftAnim.frames.length; i++) {
      const idx = allFrames.length
      walkRightRects.push({
        col: idx % COLS,
        row: Math.floor(idx / COLS),
        w: FRAME_W,
        h: FRAME_H,
      })
      const f = walkLeftAnim.frames[i]
      walkRightFrames.push({
        ...f,
        direction: 1 as const,
        leftArm: { ...f.rightArm },
        rightArm: { ...f.leftArm },
        leftFoot: { ...f.rightFoot },
        rightFoot: { ...f.leftFoot },
      })
      allFrames.push(walkRightFrames[walkRightFrames.length - 1])
    }

    frameRects.set('walk_right', walkRightRects)
    animations.set('walk_right', {
      action: 'walk_right',
      frames: walkRightFrames,
      frameDuration: walkLeftAnim.frameDuration,
      loop: walkLeftAnim.loop,
    })

    // 创建 Sprite Sheet Canvas
    const totalFrames = allFrames.length
    const rows = Math.ceil(totalFrames / COLS)
    const sheetW = COLS * FRAME_W
    const sheetH = rows * FRAME_H

    const canvas = document.createElement('canvas')
    canvas.width = sheetW
    canvas.height = sheetH
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false

    for (let i = 0; i < allFrames.length; i++) {
      const params = allFrames[i]
      const col = i % COLS
      const row = Math.floor(i / COLS)
      const ox = col * FRAME_W
      const oy = row * FRAME_H

      const imageData = ctx.createImageData(FRAME_W, FRAME_H)
      this.drawer.drawFrame(imageData.data, params)

      if (params.direction === 1) {
        const flipped = flipHorizontal(imageData.data, FRAME_W, FRAME_H)
        imageData.data.set(flipped)
      }

      ctx.putImageData(imageData, ox, oy)
    }

    return {
      canvas,
      frameRects,
      animations,
      frameSize: { w: FRAME_W, h: FRAME_H },
    }
  }
}
