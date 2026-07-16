import type { PetAction } from './types'
import type { SpriteAnimation } from './SpriteGenerator'
import type { EyeStyle, MouthStyle } from './spriteUtils'

// ============================================
// 动画帧定义 — 从 SpriteGenerator 拆出
// 10 种动作的帧参数数据
// ============================================

/** 所有动画定义 */
export function defineAnimations(): Map<PetAction, SpriteAnimation> {
  const anims = new Map<PetAction, SpriteAnimation>()

 // ---- idle_stand: 6帧, 站立微晃+眨眼 ----
  anims.set('idle_stand', {
    action: 'idle_stand',
    frameDuration: 200,
    loop: true,
    frames: [
      { bodyX: 0, bodyY: 0, leftArm: { x: -9, y: 6 }, rightArm: { x: 9, y: 6 }, leftFoot: { x: -5, y: 17 }, rightFoot: { x: 5, y: 17 }, eyeStyle: 'open', mouthStyle: 'smile', showBlush: false, direction: -1 },
      { bodyX: 0, bodyY: -1, leftArm: { x: -9, y: 5 }, rightArm: { x: 9, y: 5 }, leftFoot: { x: -5, y: 17 }, rightFoot: { x: 5, y: 17 }, eyeStyle: 'open', mouthStyle: 'smile', showBlush: false, direction: -1 },
      { bodyX: 0, bodyY: 0, leftArm: { x: -9, y: 6 }, rightArm: { x: 9, y: 6 }, leftFoot: { x: -5, y: 17 }, rightFoot: { x: 5, y: 17 }, eyeStyle: 'open', mouthStyle: 'smile', showBlush: false, direction: -1 },
      { bodyX: 0, bodyY: -1, leftArm: { x: -10, y: 5 }, rightArm: { x: 10, y: 5 }, leftFoot: { x: -5, y: 17 }, rightFoot: { x: 5, y: 17 }, eyeStyle: 'closed', mouthStyle: 'smile', showBlush: false, direction: -1 },
      { bodyX: 0, bodyY: 0, leftArm: { x: -9, y: 6 }, rightArm: { x: 9, y: 6 }, leftFoot: { x: -5, y: 17 }, rightFoot: { x: 5, y: 17 }, eyeStyle: 'closed', mouthStyle: 'smile', showBlush: false, direction: -1 },
      { bodyX: 0, bodyY: -1, leftArm: { x: -9, y: 5 }, rightArm: { x: 9, y: 5 }, leftFoot: { x: -5, y: 17 }, rightFoot: { x: 5, y: 17 }, eyeStyle: 'open', mouthStyle: 'smile', showBlush: false, direction: -1 },
    ],
  })

  // ---- idle_breathe: 6帧, 深呼吸身体起伏 ----
  const breatheY = [0, 1, 2, 3, 2, 1]
  anims.set('idle_breathe', {
    action: 'idle_breathe',
    frameDuration: 250,
    loop: true,
    frames: breatheY.map((by) => ({
      bodyX: 0, bodyY: by, leftArm: { x: -9, y: 6 + Math.round(by * 0.5) }, rightArm: { x: 9, y: 6 + Math.round(by * 0.5) }, leftFoot: { x: -5, y: 17 }, rightFoot: { x: 5, y: 17 }, eyeStyle: 'open' as EyeStyle, mouthStyle: 'closed' as MouthStyle, showBlush: false, direction: -1 as const,
    })),
  })

  // ---- walk_left: 8帧, 左走迈步 ----
  const walkCycle = [
    { lx: -6, ly: 15, rx: 5, ry: 17, lax: -10, lay: 6, rax: 8, ray: 7 },
    { lx: -5, ly: 14, rx: 6, ry: 16, lax: -11, lay: 5, rax: 7, ray: 6 },
    { lx: -7, ly: 15, rx: 4, ry: 17, lax: -9, lay: 6, rax: 9, ray: 7 },
    { lx: -6, ly: 16, rx: 5, ry: 16, lax: -10, lay: 7, rax: 8, ray: 6 },
    { lx: -5, ly: 15, rx: 6, ry: 15, lax: -11, lay: 6, rax: 7, ray: 7 },
    { lx: -4, ly: 14, rx: 7, ry: 16, lax: -10, lay: 5, rax: 8, ray: 6 },
    { lx: -6, ly: 15, rx: 5, ry: 17, lax: -9, lay: 7, rax: 9, ray: 6 },
    { lx: -7, ly: 16, rx: 4, ry: 16, lax: -10, lay: 6, rax: 8, ray: 7 },
  ]
  anims.set('walk_left', {
    action: 'walk_left',
    frameDuration: 100,
    loop: true,
    frames: walkCycle.map((w) => ({
      bodyX: 0, bodyY: 0, leftArm: { x: w.lax, y: w.lay }, rightArm: { x: w.rax, y: w.ray }, leftFoot: { x: w.lx, y: w.ly }, rightFoot: { x: w.rx, y: w.ry }, eyeStyle: 'open' as EyeStyle, mouthStyle: 'closed' as MouthStyle, showBlush: false, direction: -1 as const,
    })),
  })

  // ---- bounce: 4帧, 弹跳 ----
  const bounceY = [-6, -3, 0, -2]
  anims.set('bounce', {
    action: 'bounce',
    frameDuration: 150,
    loop: true,
    frames: bounceY.map((by) => ({
      bodyX: 0, bodyY: by, leftArm: { x: -11, y: 3 + by }, rightArm: { x: 11, y: 3 + by }, leftFoot: { x: -5, y: 17 }, rightFoot: { x: 5, y: 17 }, eyeStyle: 'happy' as EyeStyle, mouthStyle: 'open' as MouthStyle, showBlush: true, direction: -1 as const,
    })),
  })

  // ---- sleep: 6帧, 闭眼呼吸 ----
  const sleepBreath = [0, 1, 2, 3, 2, 1]
  anims.set('sleep', {
    action: 'sleep',
    frameDuration: 300,
    loop: true,
    frames: sleepBreath.map((by) => ({
      bodyX: 0, bodyY: by, leftArm: { x: -8, y: 8 + by }, rightArm: { x: 8, y: 8 + by }, leftFoot: { x: -5, y: 17 }, rightFoot: { x: 5, y: 17 }, eyeStyle: 'sleeping' as EyeStyle, mouthStyle: 'line' as MouthStyle, showBlush: false, direction: -1 as const,
    })),
  })

  // ---- wave: 4帧, 挥手 ----
  const waveArm = [
    { x: 10, y: -3 },
    { x: 11, y: -6 },
    { x: 10, y: -3 },
    { x: 11, y: -6 },
  ]
  anims.set('wave', {
    action: 'wave',
    frameDuration: 200,
    loop: true,
    frames: waveArm.map((ra) => ({
      bodyX: 0, bodyY: 0, leftArm: { x: -9, y: 6 }, rightArm: { x: ra.x, y: ra.y }, leftFoot: { x: -5, y: 17 }, rightFoot: { x: 5, y: 17 }, eyeStyle: 'happy' as EyeStyle, mouthStyle: 'open' as MouthStyle, showBlush: true, direction: -1 as const,
    })),
  })

  // ---- think: 4帧, 歪头思考 ----
  const thinkTilt = [-1, 0, 1, 0]
  anims.set('think', {
    action: 'think',
    frameDuration: 250,
    loop: true,
    frames: thinkTilt.map((tilt) => ({
      bodyX: tilt, bodyY: 0, leftArm: { x: -9, y: 6 }, rightArm: { x: 7, y: 1 }, leftFoot: { x: -5, y: 17 }, rightFoot: { x: 5, y: 17 }, eyeStyle: 'thinking' as EyeStyle, mouthStyle: 'line' as MouthStyle, showBlush: false, direction: -1 as const,
    })),
  })

  // ---- eat: 6帧, 咀嚼 ----
  const eatMouth: MouthStyle[] = ['closed', 'open', 'closed', 'open', 'closed', 'open']
  anims.set('eat', {
    action: 'eat',
    frameDuration: 200,
    loop: true,
    frames: eatMouth.map((ms) => ({
      bodyX: 0, bodyY: 0, leftArm: { x: -9, y: 6 }, rightArm: { x: 6, y: 0 }, leftFoot: { x: -5, y: 17 }, rightFoot: { x: 5, y: 17 }, eyeStyle: 'happy' as EyeStyle, mouthStyle: ms, showBlush: false, direction: -1 as const,
    })),
  })

  // ---- play: 6帧, 蹦跳玩耍 ----
  const playY = [-3, -5, -3, 0, -2, 0]
  anims.set('play', {
    action: 'play',
    frameDuration: 150,
    loop: true,
    frames: playY.map((by) => ({
      bodyX: 0, bodyY: by, leftArm: { x: -11, y: 3 + by }, rightArm: { x: 11, y: 3 + by }, leftFoot: { x: -6, y: 17 }, rightFoot: { x: 6, y: 17 }, eyeStyle: 'happy' as EyeStyle, mouthStyle: 'open' as MouthStyle, showBlush: true, direction: -1 as const,
    })),
  })

  return anims
}
