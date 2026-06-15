import type { PetMood, PetAction, PetState } from './types'

// ============================================
// 宠物表情状态机
// ============================================

interface MoodTransition {
  from: PetMood
  to: PetMood
  condition: (state: PetState) => boolean
  priority: number
}

/** 心情 → 默认行为映射 */
export const moodActionMap: Record<PetMood, PetAction> = {
  happy: 'idle_stand',
  idle: 'idle_breathe',
  bored: 'idle_stand',
  sleeping: 'sleep',
  excited: 'bounce',
  shy: 'idle_stand',
  angry: 'idle_stand',
  thinking: 'think',
  surprised: 'bounce',
}

/** 心情 → 对话提示语 */
export const moodGreetingMap: Record<PetMood, string[]> = {
  happy: ['好开心呀～ ✨', '嘿嘿～', '你来了呀！'],
  idle: ['嗯…', '…', '在呢～'],
  bored: ['好无聊啊…', '陪我玩嘛～', '…zzZ…啊？'],
  sleeping: ['zzZ…', '…嗯…zzZ…', '（呼呼大睡中）'],
  excited: ['太棒啦！！', '耶耶耶！🎉', '冲冲冲！'],
  shy: ['嘿嘿…', '不要一直看我啦…', '…你好'],
  angry: ['哼！', '…不理你', '气鼓鼓 > <'],
  thinking: ['让我想想… 🤔', 'emmm…', '嗯…这个问题…'],
  surprised: ['哇！', '什么什么！', '！'],
}

/** 预定义的心情转换规则 */
const transitions: MoodTransition[] = [
  // 闲置超时 → 无聊
  { from: 'happy', to: 'idle', condition: (s) => idleTooLong(s, 60_000), priority: 1 },
  { from: 'idle', to: 'bored', condition: (s) => idleTooLong(s, 180_000), priority: 1 },
  { from: 'bored', to: 'sleeping', condition: (s) => idleTooLong(s, 600_000), priority: 1 },

  // 用户互动 → 开心
  { from: 'idle', to: 'happy', condition: (s) => justInteracted(s, 5_000), priority: 3 },
  { from: 'bored', to: 'happy', condition: (s) => justInteracted(s, 5_000), priority: 3 },
  { from: 'sleeping', to: 'surprised', condition: (s) => justInteracted(s, 2_000), priority: 5 },

  // 惊讶后恢复
  { from: 'surprised', to: 'happy', condition: (s) => idleTooLong(s, 3_000), priority: 2 },

  // 深夜 → 困
  { from: 'happy', to: 'thinking', condition: () => isLateNight(), priority: 0 },
  { from: 'idle', to: 'sleeping', condition: () => isLateNight() && isIdleLong(), priority: 0 },
]

function idleTooLong(state: PetState, ms: number): boolean {
  return Date.now() - state.lastInteractionTime > ms
}

function justInteracted(state: PetState, withinMs: number): boolean {
  return Date.now() - state.lastInteractionTime < withinMs
}

function isLateNight(): boolean {
  const h = new Date().getHours()
  return h >= 23 || h < 6
}

function isIdleLong(): boolean {
  // 简化：深夜5分钟无操作
  return true
}

// ============================================
// StateMachine
// ============================================

export class StateMachine {
  private currentMood: PetMood = 'happy'
  private listeners: Array<(mood: PetMood, action: PetAction) => void> = []

  get mood(): PetMood {
    return this.currentMood
  }

  get action(): PetAction {
    return moodActionMap[this.currentMood]
  }

  /** 注册状态变化回调 */
  onChange(fn: (mood: PetMood, action: PetAction) => void) {
    this.listeners.push(fn)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn)
    }
  }

  /** 强制设置心情（用户互动时调用） */
  setMood(mood: PetMood) {
    if (this.currentMood === mood) return
    const prev = this.currentMood
    this.currentMood = mood
    const action = moodActionMap[mood]
    this.listeners.forEach((fn) => fn(mood, action))
    console.log(`[StateMachine] ${prev} → ${mood} (${action})`)
  }

  /** 每帧 tick，检查自动转换 */
  tick(state: PetState) {
    // 按优先级排序，高优先级先检查
    const sorted = transitions
      .filter((t) => t.from === this.currentMood)
      .sort((a, b) => b.priority - a.priority)

    for (const t of sorted) {
      if (t.condition(state)) {
        this.setMood(t.to)
        return
      }
    }
  }

  /** 获取当前心情的随机问候语 */
  getRandomGreeting(): string {
    const greetings = moodGreetingMap[this.currentMood]
    return greetings[Math.floor(Math.random() * greetings.length)]
  }
}
