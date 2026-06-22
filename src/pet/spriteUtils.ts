// ============================================
// 像素绘制底层工具
// 从 SpriteGenerator.ts 拆出
// ============================================

/** 精灵单帧尺寸 */
export const FRAME_W = 48
export const FRAME_H = 48

/** Sprite Sheet 列数 */
export const COLS = 8

/** 眼睛风格 */
export type EyeStyle = 'open' | 'happy' | 'closed' | 'sleeping' | 'thinking' | 'surprised' | 'angry'

/** 嘴巴风格 */
export type MouthStyle = 'smile' | 'open' | 'closed' | 'line' | 'o' | 'frown' | 'wave'

/** 一帧的绘制参数 */
export interface FrameParams {
  bodyX: number
  bodyY: number
  leftArm: { x: number; y: number }
  rightArm: { x: number; y: number }
  leftFoot: { x: number; y: number }
  rightFoot: { x: number; y: number }
  eyeStyle: EyeStyle
  mouthStyle: MouthStyle
  showBlush: boolean
  direction: -1 | 1
}

// ---- 颜色工具 ----

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

export function blendColor(hex: string, whitePercent: number): [number, number, number] {
  const [r, g, b] = hexToRgb(hex)
  return [
    Math.round(r + (255 - r) * whitePercent),
    Math.round(g + (255 - g) * whitePercent),
    Math.round(b + (255 - b) * whitePercent),
  ]
}

export function darkenColor(hex: string, factor: number): [number, number, number] {
  const [r, g, b] = hexToRgb(hex)
  return [Math.round(r * factor), Math.round(g * factor), Math.round(b * factor)]
}

// ---- 像素绘制工具 ----

export function setPixel(data: Uint8ClampedArray, x: number, y: number, w: number, r: number, g: number, b: number, a: number) {
  const ix = Math.round(x)
  const iy = Math.round(y)
  if (ix < 0 || iy < 0 || ix >= w || iy >= FRAME_H) return
  const i = (iy * w + ix) * 4
  data[i] = r
  data[i + 1] = g
  data[i + 2] = b
  data[i + 3] = a
}

export function fillRect(
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

export function fillEllipse(
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
export function flipHorizontal(src: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray {
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

/** 绘制像素风轮廓线 */
export function drawEllipseOutline(
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
