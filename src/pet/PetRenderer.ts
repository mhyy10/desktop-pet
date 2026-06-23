import type { PetMood, PetAction, PetTheme } from './types'
import type { IRenderer } from './IRenderer'
import { defaultTheme } from './theme'

// ============================================
// 宠物 Canvas 渲染器
// 绘制小光（Lumie）— 纯代码绘制，无需外部精灵图
// 实现 IRenderer 接口
// ============================================

export class PetRenderer implements IRenderer {
  private ctx: CanvasRenderingContext2D
  private theme: PetTheme
  private breathOffset = 0
  private blinkTimer = 0
  private isBlinking = false
  private bounceOffset = 0
  private walkCycle = 0

  private _isReady = false

  constructor(ctx: CanvasRenderingContext2D, theme: PetTheme = defaultTheme) {
    this.ctx = ctx
    this.theme = theme
    this._isReady = true
  }

  /** Canvas 渲染器无需异步初始化 */
  async init(): Promise<void> {
    this._isReady = true
  }

  /** 切换主题 */
  async reinit(theme: PetTheme): Promise<void> {
    this.theme = theme
  }

  get isReady(): boolean {
    return this._isReady
  }

  /** Canvas 渲染器无需帧推进（动画在 draw 中计算） */
  tick(_deltaMs: number): void {
    // no-op
  }

  /** Canvas 渲染器每帧都变化，始终返回 true */
  get hasFrameChanged(): boolean {
    return true
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
    const ctx = this.ctx
    ctx.save()
    ctx.translate(centerX, centerY)
    ctx.scale(scale, scale)

    // 计算动画偏移
    this.updateAnimations(action, timeMs)

    const breathY = Math.sin(this.breathOffset) * 2
    const bounceY = this.bounceOffset

    // 1. 身体发光
    this.drawGlow(0, breathY + bounceY)

    // 2. 身体
    this.drawBody(0, breathY + bounceY)

    // 3. 脸部
    this.drawFace(0, breathY + bounceY - 10, mood, timeMs)

    // 4. 手臂
    this.drawArms(0, breathY + bounceY, action, timeMs)

    // 5. 脚
    this.drawFeet(0, breathY + bounceY, action, timeMs)

    // 6. 装饰粒子（取决于心情）
    if (mood === 'happy' || mood === 'excited') {
      this.drawAuraSparks(0, breathY + bounceY, timeMs)
    }

    ctx.restore()
  }

  // ---- 动画计算 ----

  private updateAnimations(action: PetAction, timeMs: number) {
    // 呼吸
    this.breathOffset += 0.03

    // 弹跳
    if (action === 'bounce') {
      this.bounceOffset = Math.abs(Math.sin(timeMs * 0.005)) * -15
    } else {
      this.bounceOffset *= 0.9
    }

    // 眨眼
    this.blinkTimer += 16
    if (!this.isBlinking && this.blinkTimer > 3000 + Math.random() * 2000) {
      this.isBlinking = true
      this.blinkTimer = 0
    }
    if (this.isBlinking && this.blinkTimer > 150) {
      this.isBlinking = false
      this.blinkTimer = 0
    }

    // 走路
    if (action === 'walk_left' || action === 'walk_right') {
      this.walkCycle += 0.1
    }
  }

  // ---- 绘制组件 ----

  private drawGlow(x: number, y: number) {
    const ctx = this.ctx
    const gradient = ctx.createRadialGradient(x, y, 10, x, y, 50)
    gradient.addColorStop(0, this.theme.glowColor + '30')
    gradient.addColorStop(1, this.theme.glowColor + '00')
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(x, y, 50, 0, Math.PI * 2)
    ctx.fill()
  }

  private drawBody(x: number, y: number) {
    const ctx = this.ctx

    // 身体 — 胶囊形
    ctx.fillStyle = this.theme.bodyColor
    ctx.beginPath()
    ctx.ellipse(x, y, 28, 35, 0, 0, Math.PI * 2)
    ctx.fill()

    // 身体高光
    ctx.fillStyle = 'rgba(255,255,255,0.15)'
    ctx.beginPath()
    ctx.ellipse(x - 8, y - 10, 12, 20, -0.3, 0, Math.PI * 2)
    ctx.fill()

    // 发光纹路
    ctx.strokeStyle = this.theme.glowColor + '60'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(x - 12, y + 5)
    ctx.quadraticCurveTo(x, y + 10, x + 12, y + 5)
    ctx.stroke()
  }

  private drawFace(x: number, y: number, mood: PetMood, timeMs: number) {
    const ctx = this.ctx

    // 眼睛
    const eyeSpacing = 10
    const eyeY = y - 5

    if (mood === 'sleeping' || this.isBlinking) {
      // 闭眼 — 弧线
      ctx.strokeStyle = this.theme.eyeColor
      ctx.lineWidth = 2
      ctx.lineCap = 'round'

      ctx.beginPath()
      ctx.arc(x - eyeSpacing, eyeY, 4, 0, Math.PI)
      ctx.stroke()

      ctx.beginPath()
      ctx.arc(x + eyeSpacing, eyeY, 4, 0, Math.PI)
      ctx.stroke()
    } else if (mood === 'happy' || mood === 'excited') {
      // 开心 — 弯月眼
      ctx.strokeStyle = this.theme.eyeColor
      ctx.lineWidth = 2.5
      ctx.lineCap = 'round'

      ctx.beginPath()
      ctx.arc(x - eyeSpacing, eyeY + 2, 5, Math.PI + 0.3, -0.3)
      ctx.stroke()

      ctx.beginPath()
      ctx.arc(x + eyeSpacing, eyeY + 2, 5, Math.PI + 0.3, -0.3)
      ctx.stroke()
    } else {
      // 普通大眼睛
      // 眼白
      ctx.fillStyle = '#FFFFFF'
      ctx.beginPath()
      ctx.ellipse(x - eyeSpacing, eyeY, 6, 7, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.ellipse(x + eyeSpacing, eyeY, 6, 7, 0, 0, Math.PI * 2)
      ctx.fill()

      // 瞳孔
      ctx.fillStyle = this.theme.eyeColor
      const pupilOffset = mood === 'thinking' ? Math.sin(timeMs * 0.002) * 2 : 0
      ctx.beginPath()
      ctx.arc(x - eyeSpacing + pupilOffset, eyeY, 3.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(x + eyeSpacing + pupilOffset, eyeY, 3.5, 0, Math.PI * 2)
      ctx.fill()

      // 高光
      ctx.fillStyle = '#FFFFFF'
      ctx.beginPath()
      ctx.arc(x - eyeSpacing + 1.5, eyeY - 2, 1.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(x + eyeSpacing + 1.5, eyeY - 2, 1.5, 0, Math.PI * 2)
      ctx.fill()
    }

    // 腮红
    if (mood === 'happy' || mood === 'shy' || mood === 'excited') {
      ctx.fillStyle = this.theme.cheekColor + '50'
      ctx.beginPath()
      ctx.ellipse(x - 16, eyeY + 6, 5, 3, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.ellipse(x + 16, eyeY + 6, 5, 3, 0, 0, Math.PI * 2)
      ctx.fill()
    }

    // 嘴巴
    ctx.strokeStyle = this.theme.eyeColor
    ctx.lineWidth = 1.5
    ctx.lineCap = 'round'

    const mouthY = eyeY + 10
    switch (mood) {
      case 'happy':
      case 'excited':
        ctx.beginPath()
        ctx.arc(x, mouthY - 2, 5, 0.2, Math.PI - 0.2)
        ctx.stroke()
        break
      case 'surprised':
        ctx.fillStyle = this.theme.eyeColor
        ctx.beginPath()
        ctx.arc(x, mouthY, 4, 0, Math.PI * 2)
        ctx.fill()
        break
      case 'angry':
        ctx.beginPath()
        ctx.arc(x, mouthY + 3, 5, Math.PI + 0.3, -0.3)
        ctx.stroke()
        // 眉毛
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(x - eyeSpacing - 5, eyeY - 8)
        ctx.lineTo(x - eyeSpacing + 5, eyeY - 6)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(x + eyeSpacing + 5, eyeY - 8)
        ctx.lineTo(x + eyeSpacing - 5, eyeY - 6)
        ctx.stroke()
        break
      case 'thinking':
        ctx.beginPath()
        ctx.moveTo(x - 3, mouthY)
        ctx.lineTo(x + 2, mouthY + 1)
        ctx.stroke()
        break
      default:
        ctx.beginPath()
        ctx.arc(x, mouthY, 3, 0.1, Math.PI - 0.1)
        ctx.stroke()
    }
  }

  private drawArms(x: number, y: number, action: PetAction, timeMs: number) {
    const ctx = this.ctx
    ctx.strokeStyle = this.theme.bodyColor
    ctx.lineWidth = 6
    ctx.lineCap = 'round'

    const armY = y - 5

    if (action === 'wave') {
      // 挥手 — 右臂举起摆动
      const waveAngle = Math.sin(timeMs * 0.008) * 0.5
      // 左臂
      ctx.beginPath()
      ctx.moveTo(x - 25, armY)
      ctx.quadraticCurveTo(x - 38, armY + 10, x - 40, armY + 20)
      ctx.stroke()
      // 右臂挥动
      ctx.beginPath()
      ctx.moveTo(x + 25, armY)
      ctx.quadraticCurveTo(x + 38, armY - 15 + waveAngle * 10, x + 40, armY - 25 + waveAngle * 15)
      ctx.stroke()
    } else {
      // 默认 — 小手自然下垂
      const sway = Math.sin(timeMs * 0.002) * 2
      ctx.beginPath()
      ctx.moveTo(x - 25, armY)
      ctx.quadraticCurveTo(x - 35, armY + 12 + sway, x - 33, armY + 22)
      ctx.stroke()

      ctx.beginPath()
      ctx.moveTo(x + 25, armY)
      ctx.quadraticCurveTo(x + 35, armY + 12 - sway, x + 33, armY + 22)
      ctx.stroke()
    }
  }

  private drawFeet(x: number, y: number, action: PetAction, _timeMs: number) {
    const ctx = this.ctx
    ctx.fillStyle = this.theme.bodyColor

    const footY = y + 33
    const walkOffset = Math.sin(this.walkCycle) * 4

    if (action === 'walk_left' || action === 'walk_right') {
      // 走路 — 交替迈步
      ctx.beginPath()
      ctx.ellipse(x - 10 + walkOffset, footY, 8, 4, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.ellipse(x + 10 - walkOffset, footY, 8, 4, 0, 0, Math.PI * 2)
      ctx.fill()
    } else {
      // 站立
      ctx.beginPath()
      ctx.ellipse(x - 10, footY, 8, 4, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.ellipse(x + 10, footY, 8, 4, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  private drawAuraSparks(x: number, y: number, timeMs: number) {
    const ctx = this.ctx
    const count = 4
    for (let i = 0; i < count; i++) {
      const angle = (timeMs * 0.001 + (i * Math.PI * 2) / count)
      const radius = 45 + Math.sin(timeMs * 0.003 + i) * 5
      const px = x + Math.cos(angle) * radius
      const py = y + Math.sin(angle) * radius * 0.7

      ctx.fillStyle = this.theme.warm + '80'
      ctx.beginPath()
      ctx.arc(px, py, 2, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}
