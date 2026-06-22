import type { PetMood, PetAction, PetTheme } from './types'
import type { IRenderer } from './IRenderer'
import type { SpriteSheet } from './SpriteGenerator'
import { AnimationController } from './AnimationController'
import { generateSheetWithCache } from './SpriteCache'
import { defaultTheme } from './theme'

// ============================================
// 像素风渲染器 — 用精灵图绘制宠物
// 实现 IRenderer 接口，使用 IndexedDB 缓存
// ============================================

/** 渲染倍率：48px → 144px (3x) */
const RENDER_SCALE = 3

export class PixelRenderer implements IRenderer {
  private ctx: CanvasRenderingContext2D
  private theme: PetTheme
  private skinId: string
  private sheet: SpriteSheet | null = null
  private animController: AnimationController | null = null
  private _isReady = false

  constructor(ctx: CanvasRenderingContext2D, theme: PetTheme = defaultTheme, skinId: string = 'lumie') {
    this.ctx = ctx
    this.theme = theme
    this.skinId = skinId
  }

  /** 异步初始化：生成精灵图（优先使用缓存） */
  async init(): Promise<void> {
    this.sheet = await generateSheetWithCache(this.skinId, this.theme)
    this.animController = new AnimationController(this.sheet.animations)
    this._isReady = true
  }

  /** 切换主题后重新生成精灵图 */
  async reinit(newTheme: PetTheme): Promise<void> {
    this.theme = newTheme
    this._isReady = false
    await this.init()
  }

  /** 更新皮肤ID（用于缓存 key） */
  setSkinId(skinId: string): void {
    this.skinId = skinId
  }

  get isReady(): boolean {
    return this._isReady
  }

  /** 主绘制入口 */
  draw(
    mood: PetMood,
    action: PetAction,
    centerX: number,
    centerY: number,
    timeMs: number,
    scale: number = 1.0
  ) {
    if (!this.sheet || !this.animController) return

    const ctx = this.ctx
    this.animController.play(action)

    const frameIndex = this.animController.currentFrame
    const rects = this.sheet.frameRects.get(action)
    if (!rects || frameIndex >= rects.length) return

    const rect = rects[frameIndex]
    const { w, h } = this.sheet.frameSize

    ctx.save()
    ctx.translate(centerX, centerY)
    ctx.scale(scale * RENDER_SCALE, scale * RENDER_SCALE)
    ctx.imageSmoothingEnabled = false

    this.drawGlow(ctx, mood, timeMs)

    const sx = rect.col * w
    const sy = rect.row * h
    const drawX = -w / 2
    const drawY = -h / 2 + 5

    ctx.drawImage(this.sheet.canvas, sx, sy, w, h, drawX, drawY, w, h)

    if (mood === 'happy' || mood === 'excited') {
      this.drawAura(ctx, timeMs)
    }

    ctx.restore()
  }

  /** 更新动画控制器 */
  tick(deltaMs: number): { frameIndex: number; action: PetAction } {
    if (!this.animController) return { frameIndex: 0, action: 'idle_stand' }
    return this.animController.tick(deltaMs)
  }

  private drawGlow(ctx: CanvasRenderingContext2D, _mood: PetMood, timeMs: number) {
    const [r, g, b] = hexToRgb(this.theme.glowColor)
    const pulse = 0.3 + Math.sin(timeMs * 0.002) * 0.1

    ctx.save()
    ctx.globalAlpha = pulse
    ctx.shadowColor = `rgba(${r},${g},${b},0.6)`
    ctx.shadowBlur = 15
    ctx.fillStyle = `rgba(${r},${g},${b},0.05)`
    ctx.beginPath()
    ctx.arc(0, 5, 20, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  private drawAura(ctx: CanvasRenderingContext2D, timeMs: number) {
    const [r, g, b] = hexToRgb(this.theme.warm)
    const count = 4
    for (let i = 0; i < count; i++) {
      const angle = timeMs * 0.001 + (i * Math.PI * 2) / count
      const radius = 20 + Math.sin(timeMs * 0.003 + i) * 3
      const px = Math.cos(angle) * radius
      const py = Math.sin(angle) * radius * 0.6 + 5

      ctx.save()
      ctx.globalAlpha = 0.6
      ctx.fillStyle = `rgba(${r},${g},${b},0.8)`
      ctx.fillRect(Math.round(px) - 1, Math.round(py) - 1, 2, 2)
      ctx.restore()
    }
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}
