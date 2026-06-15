// ============================================
// 弹簧物理系统 — 拖拽弹跳/边缘回弹
// ============================================

export class SpringPhysics {
  /** 当前值 */
  value: number
  /** 目标值 */
  target: number
  /** 速度 */
  velocity = 0
  /** 弹性系数 */
  stiffness: number
  /** 阻尼系数 */
  damping: number

  constructor(initial: number, stiffness = 0.15, damping = 0.75) {
    this.value = initial
    this.target = initial
    this.stiffness = stiffness
    this.damping = damping
  }

  /** 设置目标（拖拽松手时） */
  setTarget(target: number) {
    this.target = target
  }

  /** 拉伸（拖拽中直接设值） */
  stretch(value: number) {
    this.value = value
    this.velocity = 0
  }

  /** 每帧更新，返回当前值 */
  update(): number {
    const force = (this.target - this.value) * this.stiffness
    this.velocity += force
    this.velocity *= this.damping
    this.value += this.velocity

    // 接近目标时停止
    if (Math.abs(this.velocity) < 0.01 && Math.abs(this.target - this.value) < 0.1) {
      this.value = this.target
      this.velocity = 0
    }

    return this.value
  }
}

/** 2D 弹簧物理 */
export class SpringPhysics2D {
  x: SpringPhysics
  y: SpringPhysics

  constructor(ix: number, iy: number, stiffness = 0.15, damping = 0.75) {
    this.x = new SpringPhysics(ix, stiffness, damping)
    this.y = new SpringPhysics(iy, stiffness, damping)
  }

  setTarget(tx: number, ty: number) {
    this.x.setTarget(tx)
    this.y.setTarget(ty)
  }

  stretch(vx: number, vy: number) {
    this.x.stretch(vx)
    this.y.stretch(vy)
  }

  update(): { x: number; y: number } {
    return {
      x: this.x.update(),
      y: this.y.update(),
    }
  }
}
