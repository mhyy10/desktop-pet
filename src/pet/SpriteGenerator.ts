import type { PetTheme, PetAction } from './types'

// ============================================
// 像素精灵生成器 — 程序化生成像素风小光
// 48×48 像素网格，运行时生成 Sprite Sheet
// ============================================

/** 精灵单帧尺寸 */
const FRAME_W = 48
const FRAME_H = 48

/** Sprite Sheet 列数 */
const COLS = 8

/** 眼睛风格 */
type EyeStyle = 'open' | 'happy' | 'closed' | 'sleeping' | 'thinking' | 'surprised' | 'angry'

/** 嘴巴风格 */
type MouthStyle = 'smile' | 'open' | 'closed' | 'line' | 'o' | 'frown' | 'wave'

/** 一帧的绘制参数 */
interface FrameParams {
  /** 身体 X 偏移（相对中心 24） */
  bodyX: number
  /** 身体 Y 偏移（相对中心） */
  bodyY: number
  /** 左手偏移 */
  leftArm: { x: number; y: number }
  /** 右手偏移 */
  rightArm: { x: number; y: number }
  /** 左脚偏移 */
  leftFoot: { x: number; y: number }
  /** 右脚偏移 */
  rightFoot: { x: number; y: number }
  /** 眼睛风格 */
  eyeStyle: EyeStyle
  /** 嘴巴风格 */
  mouthStyle: MouthStyle
  /** 是否显示腮红 */
  showBlush: boolean
  /** 身体朝向 -1=左 1=右 */
  direction: -1 | 1
}

/** 动画定义（帧序列 + 每帧持续时间） */
export interface SpriteAnimation {
  action: PetAction
  frames: FrameParams[]
  frameDuration: number // ms
  loop: boolean
}

/** Sprite Sheet 生成结果 */
export interface SpriteSheet {
  canvas: HTMLCanvasElement
  /** action → 帧矩形列表 [col, row, w, h] */
  frameRects: Map<PetAction, { col: number; row: number; w: number; h: number }[]>
  /** action → 动画定义 */
  animations: Map<PetAction, SpriteAnimation>
  /** 每帧宽高 */
  frameSize: { w: number; h: number }
}

// ---- 颜色工具 ----

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function blendColor(hex: string, whitePercent: number): [number, number, number] {
  const [r, g, b] = hexToRgb(hex)
  return [
    Math.round(r + (255 - r) * whitePercent),
    Math.round(g + (255 - g) * whitePercent),
    Math.round(b + (255 - b) * whitePercent),
  ]
}

function darkenColor(hex: string, factor: number): [number, number, number] {
  const [r, g, b] = hexToRgb(hex)
  return [Math.round(r * factor), Math.round(g * factor), Math.round(b * factor)]
}

// ---- 像素绘制工具 ----

function setPixel(data: Uint8ClampedArray, x: number, y: number, w: number, r: number, g: number, b: number, a: number) {
  const ix = Math.round(x)
  const iy = Math.round(y)
  if (ix < 0 || iy < 0 || ix >= w || iy >= FRAME_H) return
  const i = (iy * w + ix) * 4
  data[i] = r
  data[i + 1] = g
  data[i + 2] = b
  data[i + 3] = a
}

function fillRect(
  data: Uint8ClampedArray,
  x: number, y: number, w: number,
  rw: number, rh: number,
  r: number, g: number, b: number, a: number
) {
  for (let dy = 0; dy < rh; dy++) {
    for (let dx = 0; dx < rw; dx++) {
      setPixel(data, x + dx, y + dy, w, r, g, b, a)
    }
  }
}

function fillEllipse(
  data: Uint8ClampedArray,
  cx: number, cy: number, canvasW: number,
  rx: number, ry: number,
  r: number, g: number, b: number, a: number
) {
  const rx2 = rx * rx
  const ry2 = ry * ry
  for (let dy = -ry; dy <= ry; dy++) {
    for (let dx = -rx; dx <= rx; dx++) {
      if ((dx * dx) / rx2 + (dy * dy) / ry2 <= 1) {
        setPixel(data, cx + dx, cy + dy, canvasW, r, g, b, a)
      }
    }
  }
}

/** 水平翻转一帧像素 */
function flipHorizontal(src: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray {
  const dst = new Uint8ClampedArray(src.length)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = (y * w + x) * 4
      const di = (y * w + (w - 1 - x)) * 4
      dst[di] = src[si]
      dst[di + 1] = src[si + 1]
      dst[di + 2] = src[si + 2]
      dst[di + 3] = src[si + 3]
    }
  }
  return dst
}

/**
 * 绘制像素风轮廓线
 * 用 Bresenham 算法沿椭圆边缘画像素
 */
function drawEllipseOutline(
  data: Uint8ClampedArray,
  cx: number, cy: number, canvasW: number,
  rx: number, ry: number,
  r: number, g: number, b: number, a: number
) {
  const steps = Math.max(rx, ry) * 8
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * Math.PI * 2
    const px = cx + Math.round(Math.cos(angle) * rx)
    const py = cy + Math.round(Math.sin(angle) * ry)
    setPixel(data, px, py, canvasW, r, g, b, a)
  }
}

// ============================================
// SpriteGenerator
// ============================================

export class SpriteGenerator {
  private bodyColor: [number, number, number]
  private bodyHighlight: [number, number, number]
  private bodyShadow: [number, number, number]
  private glowColor: [number, number, number]
  private eyeColor: [number, number, number]
  private cheekColor: [number, number, number]

  constructor(theme: PetTheme) {
    this.bodyColor = hexToRgb(theme.bodyColor)
    this.bodyHighlight = blendColor(theme.bodyColor, 0.3)
    this.bodyShadow = darkenColor(theme.bodyColor, 0.7)
    this.glowColor = hexToRgb(theme.glowColor)
    this.eyeColor = hexToRgb(theme.eyeColor)
    this.cheekColor = hexToRgb(theme.cheekColor)
  }

  /** 生成完整的 Sprite Sheet */
  generate(): SpriteSheet {
    const animations = this.defineAnimations()
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
      // 翻转参数：左右互换
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
      this.drawFrame(imageData.data, params)

      // walk_right 帧水平翻转
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

  // ---- 动画定义 ----

  private defineAnimations(): Map<PetAction, SpriteAnimation> {
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

  // ---- 逐帧绘制 ----

  private drawFrame(data: Uint8ClampedArray, params: FrameParams) {
    const cx = 24 + params.bodyX // 身体中心 X
    const cy = 16 + params.bodyY // 身体中心 Y（偏上，留空间给脚）

    // 1. 发光光晕（大范围淡光）
    this.drawGlow(data, cx, cy + 3)

    // 2. 耳朵/角（小光标志性的微光角）
    this.drawEars(data, cx, cy)

    // 3. 身体（更大更圆的胶囊体）
    this.drawBody(data, cx, cy)

    // 4. 面部
    this.drawFace(data, cx, cy - 5, params)

    // 5. 发光纹路
    this.drawGlowLine(data, cx, cy + 3)

    // 6. 手臂
    this.drawArm(data, cx + params.leftArm.x, cy + params.leftArm.y)
    this.drawArm(data, cx + params.rightArm.x, cy + params.rightArm.y)

    // 7. 脚
    this.drawFoot(data, cx + params.leftFoot.x, cy + params.leftFoot.y)
    this.drawFoot(data, cx + params.rightFoot.x, cy + params.rightFoot.y)
  }

  /** 发光光晕 */
  private drawGlow(data: Uint8ClampedArray, cx: number, cy: number) {
    const [r, g, b] = this.glowColor
    fillEllipse(data, cx, cy, FRAME_W, 16, 16, r, g, b, 12)
    fillEllipse(data, cx, cy, FRAME_W, 12, 12, r, g, b, 20)
  }

  /** 小光的微光角/耳朵 */
  private drawEars(data: Uint8ClampedArray, cx: number, cy: number) {
    const [r, g, b] = this.bodyColor
    const [hr, hg, hb] = this.bodyHighlight
    const [gr, gg, gb] = this.glowColor

    // 左角 — 3px 高的小尖角
    setPixel(data, cx - 8, cy - 13, FRAME_W, r, g, b, 255)
    fillRect(data, cx - 9, cy - 12, FRAME_W, 3, 2, r, g, b, 255)
    // 角尖发光
    setPixel(data, cx - 8, cy - 14, FRAME_W, gr, gg, gb, 180)

    // 右角
    setPixel(data, cx + 8, cy - 13, FRAME_W, r, g, b, 255)
    fillRect(data, cx + 7, cy - 12, FRAME_W, 3, 2, r, g, b, 255)
    setPixel(data, cx + 8, cy - 14, FRAME_W, gr, gg, gb, 180)

    // 角根部高光
    setPixel(data, cx - 8, cy - 12, FRAME_W, hr, hg, hb, 100)
    setPixel(data, cx + 8, cy - 12, FRAME_W, hr, hg, hb, 100)
  }

  /** 身体 — 大号圆角胶囊 */
  private drawBody(data: Uint8ClampedArray, cx: number, cy: number) {
    const [r, g, b] = this.bodyColor
    const [hr, hg, hb] = this.bodyHighlight
    const [sr, sg, sb] = this.bodyShadow

    // 主体椭圆（大号 12×15）
    fillEllipse(data, cx, cy, FRAME_W, 12, 15, r, g, b, 255)

    // 身体轮廓线（深色）
    drawEllipseOutline(data, cx, cy, FRAME_W, 12, 15, sr, sg, sb, 80)

    // 高光 — 左上
    fillEllipse(data, cx - 4, cy - 6, FRAME_W, 5, 7, hr, hg, hb, 100)

    // 底部阴影弧
    fillEllipse(data, cx, cy + 8, FRAME_W, 8, 4, sr, sg, sb, 60)
  }

  /** 面部 */
  private drawFace(data: Uint8ClampedArray, cx: number, cy: number, params: FrameParams) {
    // 眼睛
    this.drawEyes(data, cx, cy, params.eyeStyle)

    // 嘴巴
    this.drawMouth(data, cx, cy + 8, params.mouthStyle)

    // 腮红
    if (params.showBlush) {
      const [cr, cg, cb] = this.cheekColor
      fillRect(data, cx - 9, cy + 5, FRAME_W, 3, 2, cr, cg, cb, 120)
      fillRect(data, cx + 7, cy + 5, FRAME_W, 3, 2, cr, cg, cb, 120)
    }
  }

  /** 眼睛 — 大号像素眼 */
  private drawEyes(data: Uint8ClampedArray, cx: number, cy: number, style: EyeStyle) {
    const [er, eg, eb] = this.eyeColor
    const eyeSpacing = 5
    const lx = cx - eyeSpacing
    const rx = cx + eyeSpacing

    switch (style) {
      case 'open': {
        // 大萌眼 — 4×4 白底 + 3×3 瞳孔 + 2×2 高光
        // 左眼
        fillRect(data, lx - 2, cy - 2, FRAME_W, 5, 5, 255, 255, 255, 255)
        fillRect(data, lx - 1, cy - 1, FRAME_W, 3, 3, er, eg, eb, 255)
        fillRect(data, lx, cy - 2, FRAME_W, 2, 2, 255, 255, 255, 200)
        // 右眼
        fillRect(data, rx - 2, cy - 2, FRAME_W, 5, 5, 255, 255, 255, 255)
        fillRect(data, rx - 1, cy - 1, FRAME_W, 3, 3, er, eg, eb, 255)
        fillRect(data, rx, cy - 2, FRAME_W, 2, 2, 255, 255, 255, 200)
        break
      }
      case 'happy': {
        // 弯月眼 — 弧形像素
        fillRect(data, lx - 2, cy, FRAME_W, 5, 3, er, eg, eb, 255)
        fillRect(data, lx - 1, cy - 1, FRAME_W, 3, 1, er, eg, eb, 180)
        setPixel(data, lx - 2, cy - 1, FRAME_W, er, eg, eb, 100)
        setPixel(data, lx + 2, cy - 1, FRAME_W, er, eg, eb, 100)
        fillRect(data, rx - 2, cy, FRAME_W, 5, 3, er, eg, eb, 255)
        fillRect(data, rx - 1, cy - 1, FRAME_W, 3, 1, er, eg, eb, 180)
        setPixel(data, rx - 2, cy - 1, FRAME_W, er, eg, eb, 100)
        setPixel(data, rx + 2, cy - 1, FRAME_W, er, eg, eb, 100)
        break
      }
      case 'closed':
      case 'sleeping': {
        // 闭眼 — 横线
        fillRect(data, lx - 2, cy, FRAME_W, 5, 2, er, eg, eb, 255)
        fillRect(data, rx - 2, cy, FRAME_W, 5, 2, er, eg, eb, 255)
        break
      }
      case 'thinking': {
        // 一只眼大一只眼小
        fillRect(data, lx - 2, cy - 2, FRAME_W, 5, 5, 255, 255, 255, 255)
        fillRect(data, lx - 1, cy - 1, FRAME_W, 3, 3, er, eg, eb, 255)
        fillRect(data, lx, cy - 2, FRAME_W, 2, 2, 255, 255, 255, 200)
        // 右眼 - 偏移瞳孔
        fillRect(data, rx - 2, cy - 2, FRAME_W, 5, 5, 255, 255, 255, 255)
        fillRect(data, rx, cy - 1, FRAME_W, 3, 3, er, eg, eb, 255)
        fillRect(data, rx + 1, cy - 2, FRAME_W, 2, 2, 255, 255, 255, 200)
        break
      }
      case 'surprised': {
        // 超大圆眼
        fillRect(data, lx - 2, cy - 3, FRAME_W, 5, 6, 255, 255, 255, 255)
        fillRect(data, lx - 1, cy - 2, FRAME_W, 3, 4, er, eg, eb, 255)
        fillRect(data, lx, cy - 3, FRAME_W, 2, 2, 255, 255, 255, 220)
        fillRect(data, rx - 2, cy - 3, FRAME_W, 5, 6, 255, 255, 255, 255)
        fillRect(data, rx - 1, cy - 2, FRAME_W, 3, 4, er, eg, eb, 255)
        fillRect(data, rx, cy - 3, FRAME_W, 2, 2, 255, 255, 255, 220)
        break
      }
      case 'angry': {
        // 眯眼 + 斜眉毛
        fillRect(data, lx - 2, cy, FRAME_W, 5, 2, er, eg, eb, 255)
        fillRect(data, rx - 2, cy, FRAME_W, 5, 2, er, eg, eb, 255)
        // 眉毛
        fillRect(data, lx - 3, cy - 4, FRAME_W, 4, 1, er, eg, eb, 255)
        setPixel(data, lx - 3, cy - 3, FRAME_W, er, eg, eb, 200)
        fillRect(data, rx, cy - 4, FRAME_W, 4, 1, er, eg, eb, 255)
        setPixel(data, rx + 3, cy - 3, FRAME_W, er, eg, eb, 200)
        break
      }
    }
  }

  /** 嘴巴 */
  private drawMouth(data: Uint8ClampedArray, cx: number, cy: number, style: MouthStyle) {
    const [er, eg, eb] = this.eyeColor

    switch (style) {
      case 'smile':
        // 像素微笑弧
        setPixel(data, cx - 3, cy - 1, FRAME_W, er, eg, eb, 160)
        fillRect(data, cx - 2, cy, FRAME_W, 5, 1, er, eg, eb, 255)
        setPixel(data, cx + 3, cy - 1, FRAME_W, er, eg, eb, 160)
        break
      case 'open':
        // 张嘴
        fillRect(data, cx - 2, cy - 1, FRAME_W, 4, 3, er, eg, eb, 255)
        setPixel(data, cx - 1, cy + 2, FRAME_W, 180, 80, 80, 120) // 舌头
        break
      case 'closed':
        // 闭嘴线
        fillRect(data, cx - 2, cy, FRAME_W, 4, 1, er, eg, eb, 255)
        break
      case 'line':
        // 直线嘴
        fillRect(data, cx - 1, cy, FRAME_W, 3, 1, er, eg, eb, 180)
        break
      case 'o':
        // O型嘴
        fillRect(data, cx - 1, cy - 1, FRAME_W, 3, 3, er, eg, eb, 255)
        setPixel(data, cx, cy, FRAME_W, 60, 30, 30, 100)
        break
      case 'frown':
        // 皱眉
        setPixel(data, cx - 3, cy + 1, FRAME_W, er, eg, eb, 160)
        fillRect(data, cx - 2, cy, FRAME_W, 5, 1, er, eg, eb, 255)
        setPixel(data, cx + 3, cy + 1, FRAME_W, er, eg, eb, 160)
        break
      case 'wave':
        // 波浪嘴
        setPixel(data, cx - 2, cy, FRAME_W, er, eg, eb, 180)
        setPixel(data, cx - 1, cy + 1, FRAME_W, er, eg, eb, 255)
        setPixel(data, cx, cy, FRAME_W, er, eg, eb, 255)
        setPixel(data, cx + 1, cy + 1, FRAME_W, er, eg, eb, 255)
        setPixel(data, cx + 2, cy, FRAME_W, er, eg, eb, 180)
        break
    }
  }

  /** 手臂 */
  private drawArm(data: Uint8ClampedArray, x: number, y: number) {
    const [r, g, b] = this.bodyColor
    const [sr, sg, sb] = this.bodyShadow
    const px = Math.round(x)
    const py = Math.round(y)
    // 3×3 像素块
    fillRect(data, px - 1, py - 1, FRAME_W, 3, 3, r, g, b, 255)
    // 小手（深色）
    fillRect(data, px - 1, py + 2, FRAME_W, 3, 2, sr, sg, sb, 255)
  }

  /** 脚 */
  private drawFoot(data: Uint8ClampedArray, x: number, y: number) {
    const [r, g, b] = this.bodyShadow
    const px = Math.round(x)
    const py = Math.round(y)
    // 5×2 像素块
    fillRect(data, px - 2, py - 1, FRAME_W, 5, 2, r, g, b, 255)
  }

  /** 发光纹路 */
  private drawGlowLine(data: Uint8ClampedArray, cx: number, cy: number) {
    const [r, g, b] = this.glowColor
    // 身体中间一条发光弧线
    fillRect(data, cx - 7, cy, FRAME_W, 15, 1, r, g, b, 80)
    setPixel(data, cx - 7, cy - 1, FRAME_W, r, g, b, 40)
    setPixel(data, cx + 7, cy - 1, FRAME_W, r, g, b, 40)
  }
}
