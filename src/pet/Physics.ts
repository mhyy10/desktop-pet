// ============================================
// 弹簧物理系统 — 拖拽弹跳/边缘回弹/惯性滑动
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
  /** 是否处于惯性模式（fling 后自由滑动） */
  private isFlinging = false

  constructor(initial: number, stiffness = 0.15, damping = 0.75) {
    this.value = initial
    this.target = initial
    this.stiffness = stiffness
    this.damping = damping
  }

  /** 设置目标（拖拽松手时） */
  setTarget(target: number) {
    this.target = target
    this.isFlinging = false
  }

  /** 拉伸（拖拽中直接设值） */
  stretch(value: number) {
    this.value = value
    this.velocity = 0
    this.isFlinging = false
  }

  /** 惯性抛出（松手时根据速度滑动） */
  fling(velocity: number) {
    this.velocity = velocity
    this.isFlinging = true
  }

  /** 每帧更新，返回当前值 */
  update(): number {
    if (this.isFlinging) {
      // 惯性模式：只减速，不回弹
      this.velocity *= this.damping
      this.value += this.velocity

      // 速度足够小时停止惯性
      if (Math.abs(this.velocity) < 0.1) {
        this.velocity = 0
        this.isFlinging = false
      }
    } else {
      // 弹簧模式：向目标回弹
      const force = (this.target - this.value) * this.stiffness
      this.velocity += force
      this.velocity *= this.damping
      this.value += this.velocity

      // 接近目标时停止
      if (Math.abs(this.velocity) < 0.01 && Math.abs(this.target - this.value) < 0.1) {
        this.value = this.target
        this.velocity = 0
      }
    }

    return this.value
  }

  /** 检测并处理边界碰撞（返回碰撞方向） */
  bounce(min: number, max: number, elasticity = 0.5): 'none' | 'min' | 'max' | 'both' {
    let hit: 'none' | 'min' | 'max' | 'both' = 'none'

    if (this.value < min) {
      this.value = min
      this.velocity = Math.abs(this.velocity) * elasticity
      hit = 'min'
    }
    if (this.value > max) {
      this.value = max
      this.velocity = -Math.abs(this.velocity) * elasticity
      hit = hit === 'min' ? 'both' : 'max'
    }

    // 碰壁后如果速度很小就停止
    if (hit !== 'none' && Math.abs(this.velocity) < 0.5) {
      this.velocity = 0
      this.isFlinging = false
    }

    return hit
  }

  /** 当前是否在惯性滑动中 */
  get isSliding(): boolean {
    return this.isFlinging
  }

  /** 停止惯性 */
  stopFling() {
    this.isFlinging = false
    this.velocity = 0
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

  /** 惯性抛出 */
  fling(vx: number, vy: number) {
    this.x.fling(vx)
    this.y.fling(vy)
  }

  /** 停止惯性 */
  stopFling() {
    this.x.stopFling()
    this.y.stopFling()
  }

  update(): { x: number; y: number } {
    return {
      x: this.x.update(),
      y: this.y.update(),
    }
  }

  /** 2D 边界碰撞 */
  bounce(
    minX: number, maxX: number,
    minY: number, maxY: number,
    elasticity = 0.5,
  ): { x: 'none' | 'min' | 'max' | 'both'; y: 'none' | 'min' | 'max' | 'both' } {
    return {
      x: this.x.bounce(minX, maxX, elasticity),
      y: this.y.bounce(minY, maxY, elasticity),
    }
  }

  /** 是否在惯性滑动中 */
  get isSliding(): boolean {
    return this.x.isSliding || this.y.isSliding
  }
}
