import type { PetState } from '../pet/types'
import type { ConversationMemory } from './ConversationMemory'

// ============================================
// 主动对话引擎 — 宠物主动开口说话
// 内置时间/事件/环境/LLM 四种触发器
// ============================================

export interface ProactiveTrigger {
  id: string
  check(petState: PetState, memory: ConversationMemory): boolean
  getMessage(petState: PetState, memory: ConversationMemory): string
  cooldown: number
}

/** 时间触发：无交互超过5分钟 */
const IDLE_TRIGGER: ProactiveTrigger = {
  id: 'idle',
  cooldown: 5 * 60_000,
  check: (s) => Date.now() - s.lastInteractionTime > 5 * 60_000 && !s.isDragging && !s.isChatOpen,
  getMessage: () => pick([
    '主人，你还在吗？ 👀',
    '好久没理我了…',
    '我在呢，随时找我呀～',
    '…有点想你了 💜',
  ]),
}

/** 事件触发：心情变 sad */
const SAD_TRIGGER: ProactiveTrigger = {
  id: 'sad_mood',
  cooldown: 3 * 60_000,
  check: (s) => s.mood === 'bored' || s.mood === 'angry',
  getMessage: () => pick([
    '我有点不开心…陪我聊聊天？',
    '呜…你都不理我 😢',
    '好无聊啊，做点什么吧～',
  ]),
}

/** 环境触发：时间段变化 */
const TIME_TRIGGER: ProactiveTrigger = {
  id: 'time_of_day',
  cooldown: 30 * 60_000,
  check: () => true, // 靠 cooldown 控制
  getMessage: () => {
    const h = new Date().getHours()
    if (h >= 6 && h < 9) return pick(['早上好！新的一天开始了 ☀️', '起床啦～早起的鸟儿有虫吃！'])
    if (h >= 12 && h < 14) return pick(['中午了，记得吃午饭哦 🍱', '午安～要不要休息一下？'])
    if (h >= 18 && h < 20) return pick(['晚上好～辛苦一天了 🌆', '该吃晚饭啦！'])
    if (h >= 22) return pick(['很晚了，该休息了 🌙', '早点睡吧，明天更精神！', '夜深了…小心熬夜哦 😴'])
    return pick(['嘿～在忙什么呢？', '我在这儿陪你 ✨'])
  },
}

/** 打招呼触发：首次互动后一段时间 */
const GREETING_TRIGGER: ProactiveTrigger = {
  id: 'greeting',
  cooldown: 10 * 60_000,
  check: (s) => s.mood === 'happy' && !s.isDragging && !s.isChatOpen,
  getMessage: (_s, memory) => {
    const facts = memory.getFacts()
    if (facts.length > 0) {
      const fact = facts[Math.floor(Math.random() * facts.length)]
      return `对了，我还记得你说过：${fact} 😊`
    }
    return pick(['今天心情怎么样？', '有什么我能帮忙的吗？', '嘿嘿～ ✨'])
  },
}

const BUILTIN_TRIGGERS: ProactiveTrigger[] = [IDLE_TRIGGER, SAD_TRIGGER, TIME_TRIGGER, GREETING_TRIGGER]

export class ProactiveEngine {
  private lastFireTime: Map<string, number> = new Map()
  private triggers: ProactiveTrigger[] = [...BUILTIN_TRIGGERS]
  /** LLM 触发器上次调用时间 */
  private lastLLMFire: number = 0
  private static readonly LLM_COOLDOWN = 30 * 60_000

  addTrigger(trigger: ProactiveTrigger): void {
    this.triggers.push(trigger)
  }

  /**
   * 检查是否有触发器满足条件，返回消息或 null
   * 每次只返回一条，优先级按数组顺序
   */
  check(petState: PetState, memory: ConversationMemory): string | null {
    const now = Date.now()

    for (const trigger of this.triggers) {
      const lastFire = this.lastFireTime.get(trigger.id) ?? 0
      if (now - lastFire < trigger.cooldown) continue

      if (trigger.check(petState, memory)) {
        this.lastFireTime.set(trigger.id, now)
        return trigger.getMessage(petState, memory)
      }
    }

    return null
  }

  /** 检查 LLM 触发器是否可用 */
  get canLLMFire(): boolean {
    return Date.now() - this.lastLLMFire > ProactiveEngine.LLM_COOLDOWN
  }

  /** 检查是否应该触发 LLM 主动对话 */
  shouldLLMFire(petState: PetState): boolean {
    if (!this.canLLMFire) return false
    if (petState.isDragging || petState.isChatOpen) return false
    if (petState.mood === 'sleeping') return false
    return true
  }

  /** 标记 LLM 触发器已使用 */
  markLLMFire(): void {
    this.lastLLMFire = Date.now()
  }
}

function pick(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)]
}
