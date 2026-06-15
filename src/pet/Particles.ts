import type { Particle, ParticleType } from './types'

// ============================================
// 像素风粒子特效系统
// 用小方块替代矢量绘制，统一像素风格
// ============================================

const PARTICLE_COLORS: Record<ParticleType, string[]> = {
  star: ['#FDCB6E', '#F39C12', '#FFEAA7'],
  heart: ['#FD79A8', '#E84393', '#FF6B6B'],
  zzz: ['#74B9FF', '#A29BFE', '#DFE6E9'],
  sparkle: ['#6C5CE7', '#A29BFE', '#FFEAA7'],
  note: ['#00B894', '#55EFC4', '#81ECEC'],
  drop: ['#74B9FF', '#0984E3', '#DFE6E9'],
}

/** 像素图案定义 — 5×5 网格 */
const PIXEL_PATTERNS: Record<ParticleType, number[][]> = {
  star: [
    [0, 0, 1, 0, 0],
    [0, 1, 1, 1, 0],
    [1, 1, 1, 1, 1],
    [0, 1, 1, 1, 0],
    [0, 0, 1, 0, 0],
  ],
  heart: [
    [0, 1, 0, 1, 0],
    [1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1],
    [0, 1, 1, 1, 0],
    [0, 0, 1, 0, 0],
  ],
  zzz: [
    [0, 0, 1, 1, 0],
    [0, 1, 0, 0, 0],
    [1, 1, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
  ],
  sparkle: [
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [1, 1, 1, 1, 1],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
  ],
  note: [
    [0, 0, 1, 1, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 1, 1, 0, 0],
    [0, 1, 1, 1, 0],
  ],
  drop: [
    [0, 0, 1, 0, 0],
    [0, 1, 1, 0, 0],
    [1, 1, 1, 1, 0],
    [0, 1, 1, 1, 0],
    [0, 0, 1, 0, 0],
  ],
}

export class ParticleSystem {
  private particles: Particle[] = []
  private nextId = 0

  /** 发射一组粒子 */
  emit(
    type: ParticleType,
    x: number,
    y: number,
    count: number = 5,
    opts?: { spread?: number; speed?: number; size?: number }
  ) {
    const spread = opts?.spread ?? 40
    const speed = opts?.speed ?? 1
    const size = opts?.size ?? 1

    for (let i = 0; i < count; i++) {
      const colors = PARTICLE_COLORS[type]
      const color = colors[Math.floor(Math.random() * colors.length)]

      this.particles.push({
        id: this.nextId++,
        type,
        x: x + (Math.random() - 0.5) * spread,
        y: y + (Math.random() - 0.5) * spread * 0.5,
        vx: (Math.random() - 0.5) * 2 * speed,
        vy: -Math.random() * 2 * speed - 0.5,
        life: 1.0,
        maxLife: 1500 + Math.random() * 1000,
        size: (3 + Math.random() * 3) * size, // 像素粒子更小
        opacity: 1.0,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.05, // 旋转更慢
        color,
      })
    }
  }

  /** 每帧更新 */
  update(deltaMs: number) {
    const dt = deltaMs / 1000

    this.particles = this.particles.filter((p) => {
      p.life -= deltaMs / p.maxLife
      if (p.life <= 0) return false

      p.x += p.vx * dt * 60
      p.y += p.vy * dt * 60
      p.vy += 0.015 * dt * 60 // 更轻的微重力
      p.opacity = Math.max(0, p.life)
      p.rotation += p.rotationSpeed

      return true
    })
  }

  /** 在 Canvas 上绘制（像素风） */
  draw(ctx: CanvasRenderingContext2D) {
    ctx.save()
    ctx.imageSmoothingEnabled = false // 保持像素锐利

    for (const p of this.particles) {
      const pattern = PIXEL_PATTERNS[p.type]
      if (!pattern) continue

      ctx.save()
      ctx.globalAlpha = p.opacity
      ctx.translate(Math.round(p.x), Math.round(p.y)) // 整数坐标避免模糊

      // 像素块大小
      const pixelSize = Math.max(1, Math.round(p.size / 3))

      // 旋转（像素粒子旋转步进45度）
      if (p.type !== 'zzz' && p.type !== 'note') {
        const stepAngle = Math.round(p.rotation / (Math.PI / 4)) * (Math.PI / 4)
        ctx.rotate(stepAngle)
      }

      // 按图案绘制像素块
      ctx.fillStyle = p.color
      for (let row = 0; row < pattern.length; row++) {
        for (let col = 0; col < pattern[row].length; col++) {
          if (pattern[row][col]) {
            ctx.fillRect(
              (col - 2) * pixelSize,
              (row - 2) * pixelSize,
              pixelSize,
              pixelSize
            )
          }
        }
      }

      ctx.restore()
    }

    ctx.restore()
  }

  get count(): number {
    return this.particles.length
  }
}
