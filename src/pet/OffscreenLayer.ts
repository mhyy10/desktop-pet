// ============================================
// 离屏 Canvas 分层管理
// 宠物层 + 粒子层 → 主 Canvas 合成
// 脏标记策略：仅变化时重绘
// ============================================

export class OffscreenLayer {
  private petCanvas: HTMLCanvasElement
  private particleCanvas: HTMLCanvasElement
  petCtx: CanvasRenderingContext2D
  particleCtx: CanvasRenderingContext2D

  private petDirty = true
  private particleDirty = true

  constructor(width: number, height: number) {
    this.petCanvas = document.createElement('canvas')
    this.petCanvas.width = width
    this.petCanvas.height = height
    this.petCtx = this.petCanvas.getContext('2d')!
    this.petCtx.imageSmoothingEnabled = false

    this.particleCanvas = document.createElement('canvas')
    this.particleCanvas.width = width
    this.particleCanvas.height = height
    this.particleCtx = this.particleCanvas.getContext('2d')!
    this.particleCtx.imageSmoothingEnabled = false
  }

  /** 标记宠物层脏 */
  markPetDirty(): void {
    this.petDirty = true
  }

  /** 标记粒子层脏 */
  markParticleDirty(): void {
    this.particleDirty = true
  }

  /** 宠物层是否脏 */
  get isPetDirty(): boolean {
    return this.petDirty
  }

  /** 粒子层是否脏 */
  get isParticleDirty(): boolean {
    return this.particleDirty
  }

  /** 宠物层绘制完毕，清除脏标记 */
  clearPetDirty(): void {
    this.petDirty = false
  }

  /** 粒子层绘制完毕，清除脏标记 */
  clearParticleDirty(): void {
    this.particleDirty = false
  }

  /** 合成到主 Canvas */
  composite(mainCtx: CanvasRenderingContext2D): void {
    mainCtx.clearRect(0, 0, this.petCanvas.width, this.petCanvas.height)
    mainCtx.imageSmoothingEnabled = false
    mainCtx.drawImage(this.petCanvas, 0, 0)
    mainCtx.drawImage(this.particleCanvas, 0, 0)
  }

  /** 清除宠物层 */
  clearPet(): void {
    this.petCtx.clearRect(0, 0, this.petCanvas.width, this.petCanvas.height)
  }

  /** 清除粒子层 */
  clearParticle(): void {
    this.particleCtx.clearRect(0, 0, this.particleCanvas.width, this.particleCanvas.height)
  }

  /** 尺寸变更时重新设置 */
  resize(width: number, height: number): void {
    this.petCanvas.width = width
    this.petCanvas.height = height
    this.particleCanvas.width = width
    this.particleCanvas.height = height
    this.petDirty = true
    this.particleDirty = true
  }
}
