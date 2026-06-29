import type { ChatMessage } from '../pet/types'
import { ConversationMemory } from './ConversationMemory'
import type { FactCategory, FactImportance } from './memoryTypes'

// ============================================
// AI 对话引擎
// 支持本地模拟 + 云端 LLM 双模式
// 集成 ConversationMemory 会话记忆
// ============================================

type ChatEngineMode = 'mock' | 'cloud'

interface ChatEngineConfig {
  mode: ChatEngineMode
  apiKey?: string
  baseUrl?: string
  model?: string
  systemPrompt?: string
  petName?: string
}

/** 可用模型列表 */
export const AVAILABLE_MODELS = [
  { id: 'zhanlu/glm-5.1', name: 'GLM 5.1', tag: '推荐' },
  { id: 'zhanlu/qwen3.6-plus', name: 'Qwen 3.6 Plus', tag: '均衡' },
  { id: 'zhanlu/qwen3.6-35b-a3b', name: 'Qwen 3.6 35B', tag: '轻量' },
  { id: 'zhanlu/glm-4.7', name: 'GLM 4.7', tag: '经典' },
  { id: 'zhanlu/minimax-m3', name: 'MiniMax M3', tag: '创意' },
  { id: 'zhanlu/minimax-2.7', name: 'MiniMax 2.7', tag: '快速' },
] as const

export type AvailableModelId = (typeof AVAILABLE_MODELS)[number]['id']

export class ChatEngine {
  private config: ChatEngineConfig
  private history: ChatMessage[] = []
  private memory: ConversationMemory
  private abortController: AbortController | null = null
  private failCount = 0
  private static readonly MAX_FAIL = 3

  constructor(config?: Partial<ChatEngineConfig>) {
    this.config = {
      mode: config?.mode ?? 'cloud',
      apiKey: config?.apiKey ?? 'sk-cOz4wWrca5cvaus59jR6FQ',
      baseUrl: config?.baseUrl ?? 'http://10.155.208.190:31114/aigateway/v1',
      model: config?.model ?? 'zhanlu/glm-5.1',
      systemPrompt: config?.systemPrompt,
      petName: config?.petName ?? '小光',
    }
    this.memory = new ConversationMemory()
  }

  /** 发送消息，返回宠物回复 */
  async chat(userText: string, mood: string = 'happy'): Promise<string> {
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userText,
      timestamp: Date.now(),
    }
    this.history.push(userMsg)
    this.memory.addMessage(userMsg)

    let reply: string

    const shouldUseCloud =
      this.config.mode === 'cloud' &&
      this.config.apiKey &&
      this.failCount < ChatEngine.MAX_FAIL

    if (shouldUseCloud) {
      try {
        reply = await this.callCloudAPI(mood, userText)
        this.failCount = 0
      } catch {
        this.failCount++
        console.warn(`[ChatEngine] cloud fail (${this.failCount}/${ChatEngine.MAX_FAIL}), fallback to mock`)
        reply = await this.mockReply(userText)
      }
    } else {
      reply = await this.mockReply(userText)
    }

    const petMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'pet',
      content: reply,
      timestamp: Date.now(),
    }
    this.history.push(petMsg)
    this.memory.addMessage(petMsg)

    // 每N轮尝试生成摘要
    if (this.memory.shouldSummarize && this.config.apiKey) {
      this.trySummarize()
    }

    return reply
  }

  /** 取消当前请求 */
  abort() {
    this.abortController?.abort()
    this.abortController = null
  }

  /** 清空对话历史 */
  clearHistory() {
    this.history = []
  }

  /** 更新配置 */
  updateConfig(config: Partial<ChatEngineConfig>) {
    this.config = { ...this.config, ...config }
    if (config.mode === 'cloud' || config.model) {
      this.failCount = 0
    }
  }

  get currentModel(): string {
    return this.config.model ?? 'unknown'
  }

  get currentMode(): ChatEngineMode {
    if (this.failCount >= ChatEngine.MAX_FAIL) return 'mock'
    return this.config.mode
  }

  get messages(): ChatMessage[] {
    return [...this.history]
  }

  get conversationMemory(): ConversationMemory {
    return this.memory
  }

  // ---- 搜索 ----
  async search(query: string): Promise<string> {
    const SEARCH_PROMPT = `你是一个搜索助手。用户会提出问题，你需要给出准确、有用的回答。
回答要条理清晰，可以用分点列举。用中文回答。控制在200字以内。`
    return this.callWithPrompt(SEARCH_PROMPT, query)
  }

  // ---- 翻译 ----
  async translate(text: string, direction: 'zh2en' | 'en2zh'): Promise<string> {
    const TRANSLATE_PROMPT =
      direction === 'zh2en'
        ? `你是一个翻译器。将用户输入的中文翻译成英文。只输出译文，不要任何解释或额外文字。`
        : `你是一个翻译器。将用户输入的英文翻译成中文。只输出译文，不要任何解释或额外文字。`
    return this.callWithPrompt(TRANSLATE_PROMPT, text)
  }

  // ---- 自定义 system prompt 调用 ----
  private async callWithPrompt(systemPrompt: string, userText: string): Promise<string> {
    const shouldUseCloud =
      this.config.mode === 'cloud' && this.config.apiKey && this.failCount < ChatEngine.MAX_FAIL

    if (!shouldUseCloud) return '…连接不上大脑，稍后再试 🥺'

    try {
      this.abortController = new AbortController()
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userText },
          ],
          max_tokens: 300,
          temperature: 0.5,
        }),
        signal: this.abortController.signal,
      })

      if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw new Error(`API ${response.status}: ${body.slice(0, 120)}`)
      }

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content
      if (!content) throw new Error('empty response')
      this.failCount = 0
      return content
    } catch (err) {
      this.failCount++
      console.warn('[ChatEngine] callWithPrompt fail:', err)
      return '…出了点问题，再试一次？ 🥺'
    }
  }

  // ---- 云端 API（含记忆上下文） ----
  private async callCloudAPI(mood: string, userText: string): Promise<string> {
    this.abortController = new AbortController()

    const systemPrompt = this.memory.buildContextPrompt(
      this.config.petName ?? '小光',
      mood,
      userText,
    )
    const shortTerm = this.memory.getShortTerm()

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...shortTerm.map((m) => ({
        role: m.role === 'pet' ? ('assistant' as const) : ('user' as const),
        content: m.content,
      })),
    ]

    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        max_tokens: 200,
        temperature: 0.8,
      }),
      signal: this.abortController.signal,
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(`API ${response.status}: ${body.slice(0, 120)}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) throw new Error('empty response')

    return content
  }

  // ---- 异步摘要生成（不阻塞主流程） ----
  private async trySummarize(): Promise<void> {
    try {
      const recent = this.memory.getShortTerm()
      const text = recent.map((m) => `${m.role === 'user' ? '用户' : '宠物'}: ${m.content}`).join('\n')
      const summaryPrompt = `请总结以下对话的关键内容（50字以内），并提取关于用户的关键事实（如偏好、名字、重要事件）。
严格只输出一个 JSON 对象，不要任何额外文字、不要 markdown 代码块：
{"summary":"50字以内的对话摘要","facts":[{"content":"事实内容","category":"identity|preference|event|relation|other","importance":"permanent|normal"}]}
其中 category：identity=身份（名字/职业等，importance 应为 permanent）、preference=偏好、event=事件、relation=人际关系、other=其他。importance：permanent=应永久记住、normal=普通。仅提取确实值得长期记住的事实，无则 facts 为空数组。

对话内容：
${text}`

      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [{ role: 'user', content: summaryPrompt }],
          max_tokens: 300,
          temperature: 0.3,
        }),
      })

      if (!response.ok) return
      const data = await response.json()
      const content: string = data.choices?.[0]?.message?.content
      if (!content) return

      const parsed = parseSummaryResponse(content)
      if (parsed.summary) {
        // 摘要走累积式存储（updateSummary 内部拼接最近 N 段）
        this.memory.updateSummary(parsed.summary, [])
      }
      // 事实单独走 addFact（去重 + 归一化 + 衰减），与摘要解耦
      for (const fact of parsed.facts) {
        this.memory.addFact(fact.content, fact.category, fact.importance)
      }
    } catch {
      // 摘要失败不影响主流程
    }
  }

  // ---- 本地模拟回复 ----
  private async mockReply(userText: string): Promise<string> {
    await new Promise((r) => setTimeout(r, 500 + Math.random() * 500))
    const text = userText.toLowerCase()

    if (/你好|嗨|hi|hello|hey/.test(text)) return pick(['你好呀～ ✨', '嗨嗨！', '嘿嘿，你来啦～'])
    if (/天气|weather/.test(text)) return '外面天气不错呢～记得看一眼窗外 ☀️'
    if (/吃|饿|饭|lunch|dinner|hungry/.test(text)) return pick(['要不要吃点东西？', '我也好饿…虽然我不用吃饭 😋', '该补充能量啦！'])
    if (/累|困|睡|休息|tired|sleep/.test(text)) return pick(['辛苦了，休息一下吧 🌙', '要不要趴一会儿？我帮你守着～', '早点休息呀～'])
    if (/谢谢|thanks|thank you/.test(text)) return pick(['不客气～ 💜', '嘿嘿，随时找我呀 ✨', '能帮到你就好！'])
    if (/再见|拜拜|bye/.test(text)) return pick(['拜拜～下次见！ 👋', '去忙吧，我在这等你～', '下次再来找我玩呀 💜'])
    if (/你是谁|你叫什么|who are you/.test(text)) return `我是${this.config.petName ?? '小光'}！一只住在桌面上的小精灵 ✨ 很高兴认识你～`
    if (/帮我|help|帮忙/.test(text)) return pick(['好的！说说看需要什么帮助～', '来啦来啦！💪', '尽管说～'])
    if (/无聊|boring/.test(text)) return pick(['跟我聊天就不无聊啦～', '要不要玩个小游戏？🎲', '我给你讲个笑话？'])
    if (/开[心心]|高兴|happy/.test(text)) return pick(['开心就好！✨', '你开心我也开心～ 💜', '耶！好心情要保持！'])

    return pick(['嗯嗯，我在听～', '哦哦，这样呀 🤔', '让我想想…', '收到！✨', '继续说～我在呢', '有意思！然后呢？'])
  }
}

function pick(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)]
}

// ============================================
// 摘要响应解析 — 纯函数，可单测
// 策略：优先 JSON.parse（LLM 按规范输出时），失败回退正则（兼容旧格式/格式漂移）
// ============================================

interface ParsedFact {
  content: string
  category: FactCategory
  importance: FactImportance
}

interface ParsedSummary {
  summary: string
  facts: ParsedFact[]
}

const VALID_CATEGORIES: FactCategory[] = ['identity', 'preference', 'event', 'relation', 'other']
const VALID_IMPORTANCE: FactImportance[] = ['permanent', 'normal']

function normalizeCategory(v: unknown): FactCategory {
  return VALID_CATEGORIES.includes(v as FactCategory) ? (v as FactCategory) : 'other'
}

function normalizeImportance(v: unknown): FactImportance {
  return VALID_IMPORTANCE.includes(v as FactImportance) ? (v as FactImportance) : 'normal'
}

/**
 * 解析 LLM 摘要响应。
 * 1. 尝试从内容中提取 JSON 对象并 parse（兼容被 markdown 代码块包裹的情况）
 * 2. JSON 失败则回退正则：摘要 `摘要：...`，事实 `事实：` 后每行 `- xxx`
 */
export function parseSummaryResponse(content: string): ParsedSummary {
  // ---- 策略1：JSON ----
  const jsonStr = extractJson(content)
  if (jsonStr) {
    try {
      const obj = JSON.parse(jsonStr)
      const summary = typeof obj.summary === 'string' ? obj.summary.trim() : ''
      const facts: ParsedFact[] = Array.isArray(obj.facts)
        ? obj.facts
            .map((f: unknown) => {
              if (typeof f === 'string') {
                return { content: f, category: 'other' as FactCategory, importance: 'normal' as FactImportance }
              }
              if (f && typeof f === 'object' && typeof (f as ParsedFact).content === 'string') {
                const fact = f as ParsedFact
                return {
                  content: fact.content,
                  category: normalizeCategory(fact.category),
                  importance: normalizeImportance(fact.importance),
                }
              }
              return null
            })
            .filter((f: ParsedFact | null): f is ParsedFact => f !== null && f.content.trim() !== '')
        : []
      if (summary || facts.length > 0) {
        return { summary, facts }
      }
    } catch {
      // JSON 解析失败，回退正则
    }
  }

  // ---- 策略2：正则回退 ----
  const summaryMatch = content.match(/摘要[：:]\s*([^\n]+)/)
  const factsMatch = content.match(/事实[：:]\s*\n([\s\S]*?)$/)
  const summary = summaryMatch?.[1]?.trim() ?? ''
  const facts: ParsedFact[] = (factsMatch?.[1] ?? '')
    .split('\n')
    .map((l) => l.replace(/^[-•*\s]+/, '').trim())
    .filter(Boolean)
    .map((line) => ({ content: line, category: 'other' as FactCategory, importance: 'normal' as FactImportance }))

  return { summary, facts }
}

/** 从可能含 markdown 代码块的文本中提取首个 JSON 对象字符串 */
function extractJson(content: string): string | null {
  const trimmed = content.trim()
  // 去除 markdown 代码块包裹
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed
  // 找到第一个 { 到最后一个 } 之间的内容
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  return candidate.slice(start, end + 1)
}
