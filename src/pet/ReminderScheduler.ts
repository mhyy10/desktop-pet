// ============================================
// 主动行为提醒调度器
// 基于时间段 + 用户设置，自动触发健康提醒
// ============================================

export type ReminderType = 'water' | 'meal' | 'rest' | 'night' | 'stretch'

export interface ProactiveReminder {
  id: string
  type: ReminderType
  icon: string
  text: string
}

/** 提醒触发回调 */
export type ReminderCallback = (reminder: ProactiveReminder) => void

interface ReminderRule {
  type: ReminderType
  icon: string
  /** 时间段（小时），在此范围内才可能触发 */
  hours: [number, number]
  /** 自定义消息池 */
  messages: string[]
  /** 该类型最小触发间隔（毫秒），防止重复 */
  minInterval: number
}

const RULES: ReminderRule[] = [
  {
    type: 'water',
    icon: '💧',
    hours: [8, 22],
    messages: [
      '该喝水啦～保持水分很重要 💧',
      '喝口水休息一下吧～',
      '久坐提醒：起来倒杯水吧 💧',
      '今天喝水了吗？记得补充水分～',
    ],
    minInterval: 45 * 60_000, // 45 分钟内不重复
  },
  {
    type: 'meal',
    icon: '🍽️',
    hours: [7, 22],
    messages: [
      '该吃早饭啦～别空着肚子 🥐',
      '午饭时间到！记得吃饭 🍱',
      '晚饭别太晚哦～准时吃饭 🍲',
      '肚子饿了吗？去吃点东西吧 🍽️',
    ],
    minInterval: 120 * 60_000, // 2 小时内不重复
  },
  {
    type: 'rest',
    icon: '👀',
    hours: [8, 23],
    messages: [
      '眼睛休息一下～看看远处 👀',
      '坐久了，起来活动活动吧 🧘',
      '该休息一下啦，放松肩颈 💆',
      '久坐提醒：站起来走走吧～',
    ],
    minInterval: 60 * 60_000, // 1 小时内不重复
  },
  {
    type: 'stretch',
    icon: '🤸',
    hours: [9, 21],
    messages: [
      '伸个懒腰吧～ 🤸',
      '做做拉伸，放松一下～',
      '该动一动了！简单拉伸就好 🏃',
    ],
    minInterval: 90 * 60_000, // 1.5 小时内不重复
  },
  {
    type: 'night',
    icon: '🌙',
    hours: [22, 23],
    messages: [
      '夜深了，早点休息吧 🌙',
      '该准备睡觉啦～晚安 💤',
      '别熬夜哦，明天还要精神满满！🌙',
      '晚安～记得早点睡 💜',
    ],
    minInterval: 180 * 60_000, // 3 小时内不重复（基本只触发一次）
  },
]

export class ReminderScheduler {
  private callback: ReminderCallback | null = null
  private mainTimer: ReturnType<typeof setInterval> | null = null
  private lastFired: Map<ReminderType, number> = new Map()
  private enabled: boolean = true
  private intervalMinutes: number = 60

  /** 设置回调 */
  onFire(cb: ReminderCallback) {
    this.callback = cb
  }

  /** 更新设置 */
  updateConfig(opts: { enabled?: boolean; intervalMinutes?: number }) {
    if (opts.enabled !== undefined) this.enabled = opts.enabled
    if (opts.intervalMinutes !== undefined) this.intervalMinutes = opts.intervalMinutes
    // 如果正在运行，重启调度器
    if (this.mainTimer) {
      this.stop()
      this.start()
    }
  }

  /** 启动调度器 */
  start() {
    this.stop()
    if (!this.enabled) return

    const intervalMs = this.intervalMinutes * 60_000
    // 首次触发延迟：在间隔的 30%-70% 之间随机，避免每次启动立即触发
    const firstDelay = intervalMs * (0.3 + Math.random() * 0.4)

    // 首次触发
    const firstTimer = setTimeout(() => {
      this.tick()
    }, firstDelay)

    // 后续定期触发
    this.mainTimer = setInterval(() => {
      this.tick()
    }, intervalMs)

    // 保存 firstTimer 以便清理
    this._firstTimer = firstTimer
  }

  /** 停止调度器 */
  stop() {
    if (this.mainTimer) {
      clearInterval(this.mainTimer)
      this.mainTimer = null
    }
    if (this._firstTimer) {
      clearTimeout(this._firstTimer)
      this._firstTimer = null
    }
  }

  private _firstTimer: ReturnType<typeof setTimeout> | null = null

  /** 执行一次 tick，检查所有规则 */
  private tick() {
    if (!this.enabled || !this.callback) return

    const now = Date.now()
    const hour = new Date().getHours()

    // 打乱规则顺序，避免总是按固定顺序触发
    const shuffled = [...RULES].sort(() => Math.random() - 0.5)

    for (const rule of shuffled) {
      const [startH, endH] = rule.hours
      const inRange = startH <= endH
        ? (hour >= startH && hour < endH)
        : (hour >= startH || hour < endH) // 跨午夜

      if (!inRange) continue

      const lastTime = this.lastFired.get(rule.type) ?? 0
      if (now - lastTime < rule.minInterval) continue

      // 触发
      const msg = rule.messages[Math.floor(Math.random() * rule.messages.length)]
      this.lastFired.set(rule.type, now)
      this.callback({
        id: crypto.randomUUID(),
        type: rule.type,
        icon: rule.icon,
        text: msg,
      })

      // 一次 tick 只触发一条，避免刷屏
      return
    }
  }

  /** 用户互动后重置（可选：互动后可以延迟下一次提醒） */
  onInteraction() {
    // 互动时不做特殊处理，保持原有节奏
    // 未来可以加"互动后延长间隔"逻辑
  }
}
