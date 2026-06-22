import type { PetTheme } from './types'
import type { FrameParams, EyeStyle, MouthStyle } from './spriteUtils'
import { FRAME_W, setPixel, fillRect, fillEllipse, drawEllipseOutline, hexToRgb, blendColor, darkenColor } from './spriteUtils'

// ============================================
// 精灵像素绘制器 — 从 SpriteGenerator 拆出
// 负责逐帧绘制身体/耳朵/面部/四肢/发光
// ============================================

export class SpriteDrawer {
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

  /** 绘制完整一帧 */
  drawFrame(data: Uint8ClampedArray, params: FrameParams) {
    const cx = 24 + params.bodyX
    const cy = 16 + params.bodyY

    this.drawGlow(data, cx, cy + 3)
    this.drawEars(data, cx, cy)
    this.drawBody(data, cx, cy)
    this.drawFace(data, cx, cy - 5, params)
    this.drawGlowLine(data, cx, cy + 3)
    this.drawArm(data, cx + params.leftArm.x, cy + params.leftArm.y)
    this.drawArm(data, cx + params.rightArm.x, cy + params.rightArm.y)
    this.drawFoot(data, cx + params.leftFoot.x, cy + params.leftFoot.y)
    this.drawFoot(data, cx + params.rightFoot.x, cy + params.rightFoot.y)
  }

  private drawGlow(data: Uint8ClampedArray, cx: number, cy: number) {
    const [r, g, b] = this.glowColor
    fillEllipse(data, cx, cy, FRAME_W, 16, 16, r, g, b, 12)
    fillEllipse(data, cx, cy, FRAME_W, 12, 12, r, g, b, 20)
  }

  private drawEars(data: Uint8ClampedArray, cx: number, cy: number) {
    const [r, g, b] = this.bodyColor
    const [hr, hg, hb] = this.bodyHighlight
    const [gr, gg, gb] = this.glowColor

    setPixel(data, cx - 8, cy - 13, FRAME_W, r, g, b, 255)
    fillRect(data, cx - 9, cy - 12, FRAME_W, 3, 2, r, g, b, 255)
    setPixel(data, cx - 8, cy - 14, FRAME_W, gr, gg, gb, 180)

    setPixel(data, cx + 8, cy - 13, FRAME_W, r, g, b, 255)
    fillRect(data, cx + 7, cy - 12, FRAME_W, 3, 2, r, g, b, 255)
    setPixel(data, cx + 8, cy - 14, FRAME_W, gr, gg, gb, 180)

    setPixel(data, cx - 8, cy - 12, FRAME_W, hr, hg, hb, 100)
    setPixel(data, cx + 8, cy - 12, FRAME_W, hr, hg, hb, 100)
  }

  private drawBody(data: Uint8ClampedArray, cx: number, cy: number) {
    const [r, g, b] = this.bodyColor
    const [hr, hg, hb] = this.bodyHighlight
    const [sr, sg, sb] = this.bodyShadow

    fillEllipse(data, cx, cy, FRAME_W, 12, 15, r, g, b, 255)
    drawEllipseOutline(data, cx, cy, FRAME_W, 12, 15, sr, sg, sb, 80)
    fillEllipse(data, cx - 4, cy - 6, FRAME_W, 5, 7, hr, hg, hb, 100)
    fillEllipse(data, cx, cy + 8, FRAME_W, 8, 4, sr, sg, sb, 60)
  }

  private drawFace(data: Uint8ClampedArray, cx: number, cy: number, params: FrameParams) {
    this.drawEyes(data, cx, cy, params.eyeStyle)
    this.drawMouth(data, cx, cy + 8, params.mouthStyle)
    if (params.showBlush) {
      const [cr, cg, cb] = this.cheekColor
      fillRect(data, cx - 9, cy + 5, FRAME_W, 3, 2, cr, cg, cb, 120)
      fillRect(data, cx + 7, cy + 5, FRAME_W, 3, 2, cr, cg, cb, 120)
    }
  }

  private drawEyes(data: Uint8ClampedArray, cx: number, cy: number, style: EyeStyle) {
    const [er, eg, eb] = this.eyeColor
    const eyeSpacing = 5
    const lx = cx - eyeSpacing
    const rx = cx + eyeSpacing

    switch (style) {
      case 'open': {
        fillRect(data, lx - 2, cy - 2, FRAME_W, 5, 5, 255, 255, 255, 255)
        fillRect(data, lx - 1, cy - 1, FRAME_W, 3, 3, er, eg, eb, 255)
        fillRect(data, lx, cy - 2, FRAME_W, 2, 2, 255, 255, 255, 200)
        fillRect(data, rx - 2, cy - 2, FRAME_W, 5, 5, 255, 255, 255, 255)
        fillRect(data, rx - 1, cy - 1, FRAME_W, 3, 3, er, eg, eb, 255)
        fillRect(data, rx, cy - 2, FRAME_W, 2, 2, 255, 255, 255, 200)
        break
      }
      case 'happy': {
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
        fillRect(data, lx - 2, cy, FRAME_W, 5, 2, er, eg, eb, 255)
        fillRect(data, rx - 2, cy, FRAME_W, 5, 2, er, eg, eb, 255)
        break
      }
      case 'thinking': {
        fillRect(data, lx - 2, cy - 2, FRAME_W, 5, 5, 255, 255, 255, 255)
        fillRect(data, lx - 1, cy - 1, FRAME_W, 3, 3, er, eg, eb, 255)
        fillRect(data, lx, cy - 2, FRAME_W, 2, 2, 255, 255, 255, 200)
        fillRect(data, rx - 2, cy - 2, FRAME_W, 5, 5, 255, 255, 255, 255)
        fillRect(data, rx, cy - 1, FRAME_W, 3, 3, er, eg, eb, 255)
        fillRect(data, rx + 1, cy - 2, FRAME_W, 2, 2, 255, 255, 255, 200)
        break
      }
      case 'surprised': {
        fillRect(data, lx - 2, cy - 3, FRAME_W, 5, 6, 255, 255, 255, 255)
        fillRect(data, lx - 1, cy - 2, FRAME_W, 3, 4, er, eg, eb, 255)
        fillRect(data, lx, cy - 3, FRAME_W, 2, 2, 255, 255, 255, 220)
        fillRect(data, rx - 2, cy - 3, FRAME_W, 5, 6, 255, 255, 255, 255)
        fillRect(data, rx - 1, cy - 2, FRAME_W, 3, 4, er, eg, eb, 255)
        fillRect(data, rx, cy - 3, FRAME_W, 2, 2, 255, 255, 255, 220)
        break
      }
      case 'angry': {
        fillRect(data, lx - 2, cy, FRAME_W, 5, 2, er, eg, eb, 255)
        fillRect(data, rx - 2, cy, FRAME_W, 5, 2, er, eg, eb, 255)
        fillRect(data, lx - 3, cy - 4, FRAME_W, 4, 1, er, eg, eb, 255)
        setPixel(data, lx - 3, cy - 3, FRAME_W, er, eg, eb, 200)
        fillRect(data, rx, cy - 4, FRAME_W, 4, 1, er, eg, eb, 255)
        setPixel(data, rx + 3, cy - 3, FRAME_W, er, eg, eb, 200)
        break
      }
    }
  }

  private drawMouth(data: Uint8ClampedArray, cx: number, cy: number, style: MouthStyle) {
    const [er, eg, eb] = this.eyeColor

    switch (style) {
      case 'smile':
        setPixel(data, cx - 3, cy - 1, FRAME_W, er, eg, eb, 160)
        fillRect(data, cx - 2, cy, FRAME_W, 5, 1, er, eg, eb, 255)
        setPixel(data, cx + 3, cy - 1, FRAME_W, er, eg, eb, 160)
        break
      case 'open':
        fillRect(data, cx - 2, cy - 1, FRAME_W, 4, 3, er, eg, eb, 255)
        setPixel(data, cx - 1, cy + 2, FRAME_W, 180, 80, 80, 120)
        break
      case 'closed':
        fillRect(data, cx - 2, cy, FRAME_W, 4, 1, er, eg, eb, 255)
        break
      case 'line':
        fillRect(data, cx - 1, cy, FRAME_W, 3, 1, er, eg, eb, 180)
        break
      case 'o':
        fillRect(data, cx - 1, cy - 1, FRAME_W, 3, 3, er, eg, eb, 255)
        setPixel(data, cx, cy, FRAME_W, 60, 30, 30, 100)
        break
      case 'frown':
        setPixel(data, cx - 3, cy + 1, FRAME_W, er, eg, eb, 160)
        fillRect(data, cx - 2, cy, FRAME_W, 5, 1, er, eg, eb, 255)
        setPixel(data, cx + 3, cy + 1, FRAME_W, er, eg, eb, 160)
        break
      case 'wave':
        setPixel(data, cx - 2, cy, FRAME_W, er, eg, eb, 180)
        setPixel(data, cx - 1, cy + 1, FRAME_W, er, eg, eb, 255)
        setPixel(data, cx, cy, FRAME_W, er, eg, eb, 255)
        setPixel(data, cx + 1, cy + 1, FRAME_W, er, eg, eb, 255)
        setPixel(data, cx + 2, cy, FRAME_W, er, eg, eb, 180)
        break
    }
  }

  private drawArm(data: Uint8ClampedArray, x: number, y: number) {
    const [r, g, b] = this.bodyColor
    const [sr, sg, sb] = this.bodyShadow
    const px = Math.round(x)
    const py = Math.round(y)
    fillRect(data, px - 1, py - 1, FRAME_W, 3, 3, r, g, b, 255)
    fillRect(data, px - 1, py + 2, FRAME_W, 3, 2, sr, sg, sb, 255)
  }

  private drawFoot(data: Uint8ClampedArray, x: number, y: number) {
    const [r, g, b] = this.bodyShadow
    const px = Math.round(x)
    const py = Math.round(y)
    fillRect(data, px - 2, py - 1, FRAME_W, 5, 2, r, g, b, 255)
  }

  private drawGlowLine(data: Uint8ClampedArray, cx: number, cy: number) {
    const [r, g, b] = this.glowColor
    fillRect(data, cx - 7, cy, FRAME_W, 15, 1, r, g, b, 80)
    setPixel(data, cx - 7, cy - 1, FRAME_W, r, g, b, 40)
    setPixel(data, cx + 7, cy - 1, FRAME_W, r, g, b, 40)
  }
}
