// ============================================
// 像素风音效管理器 — Web Audio API 程序化生成 8-bit 音效
// 无需外部音频文件，所有音效运行时合成
// ============================================

export type SoundType = 'click' | 'drag' | 'bounce' | 'reminder' | 'sleep' | 'walk' | 'greet' | 'double_click' | 'long_press'

export class AudioManager {
  private ctx: AudioContext | null = null
  private _enabled = true
  private _volume = 0.3

  get enabled(): boolean { return this._enabled }
  get volume(): number { return this._volume }

  /** 懒初始化（浏览器要求用户交互后才能创建 AudioContext） */
  init() {
    if (this.ctx) return
    this.ctx = new AudioContext()
  }

  /** 设置开关 */
  setEnabled(v: boolean) { this._enabled = v }

  /** 设置音量 0~1 */
  setVolume(v: number) { this._volume = Math.max(0, Math.min(1, v)) }

  /** 播放指定音效 */
  play(sound: SoundType) {
    if (!this._enabled || !this.ctx) return

    // 确保 AudioContext 处于运行状态
    if (this.ctx.state === 'suspended') {
      this.ctx.resume()
    }

    const vol = this._volume
    switch (sound) {
      case 'click': this.playClick(vol); break
      case 'double_click': this.playDoubleClick(vol); break
      case 'long_press': this.playLongPress(vol); break
      case 'drag': this.playDrag(vol); break
      case 'bounce': this.playBounce(vol); break
      case 'reminder': this.playReminder(vol); break
      case 'sleep': this.playSleep(vol); break
      case 'walk': this.playWalk(vol); break
      case 'greet': this.playGreet(vol); break
    }
  }

  // ---- 音效合成 ----

  /** 基础蜂鸣音 */
  private beep(freq: number, duration: number, type: OscillatorType = 'square', volume = 1, startDelay = 0) {
    if (!this.ctx) return
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()

    osc.type = type
    osc.frequency.value = freq

    gain.gain.value = 0
    gain.gain.setValueAtTime(0, this.ctx.currentTime + startDelay)
    gain.gain.linearRampToValueAtTime(volume * 0.15, this.ctx.currentTime + startDelay + 0.005)
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + startDelay + duration)

    osc.connect(gain)
    gain.connect(this.ctx.destination)

    osc.start(this.ctx.currentTime + startDelay)
    osc.stop(this.ctx.currentTime + startDelay + duration)
  }

  /** 点击：短促高音 */
  private playClick(vol: number) {
    this.beep(880, 0.06, 'square', vol)
  }

  /** 双击：快速双音 */
  private playDoubleClick(vol: number) {
    this.beep(1047, 0.05, 'square', vol, 0)
    this.beep(1319, 0.05, 'square', vol, 0.07)
  }

  /** 长按：低沉"唔"声 */
  private playLongPress(vol: number) {
    this.beep(330, 0.2, 'triangle', vol * 0.8)
  }

  /** 拖拽：弹簧音（上升+下降） */
  private playDrag(vol: number) {
    if (!this.ctx) return
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(300, this.ctx.currentTime)
    osc.frequency.linearRampToValueAtTime(600, this.ctx.currentTime + 0.05)
    osc.frequency.linearRampToValueAtTime(300, this.ctx.currentTime + 0.1)

    gain.gain.value = 0
    gain.gain.setValueAtTime(vol * 0.1, this.ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12)

    osc.connect(gain)
    gain.connect(this.ctx.destination)
    osc.start()
    osc.stop(this.ctx.currentTime + 0.12)
  }

  /** 弹跳：上升音阶 */
  private playBounce(vol: number) {
    this.beep(440, 0.06, 'square', vol, 0)
    this.beep(660, 0.06, 'square', vol, 0.06)
    this.beep(880, 0.08, 'square', vol * 0.8, 0.12)
  }

  /** 提醒：叮咚双音 */
  private playReminder(vol: number) {
    this.beep(1047, 0.15, 'sine', vol * 1.2, 0)
    this.beep(1319, 0.25, 'sine', vol * 1.2, 0.18)
  }

  /** 打盹：低沉柔和 */
  private playSleep(vol: number) {
    this.beep(220, 0.3, 'sine', vol * 0.5)
  }

  /** 走路：轻微滴答 */
  private playWalk(vol: number) {
    this.beep(600, 0.03, 'square', vol * 0.4)
  }

  /** 问候：欢快上升 */
  private playGreet(vol: number) {
    this.beep(523, 0.08, 'square', vol * 0.8, 0)
    this.beep(659, 0.08, 'square', vol * 0.8, 0.1)
    this.beep(784, 0.12, 'square', vol, 0.2)
  }
}

/** 全局单例 */
export const audioManager = new AudioManager()
