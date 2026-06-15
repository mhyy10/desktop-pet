import type { ChatMessage } from '../pet/types'

// ============================================
// AI 对话引擎
// 支持本地模拟 + 云端 LLM 双模式
// ============================================

type ChatEngineMode = 'mock' | 'cloud'

interface ChatEngineConfig {
  mode: ChatEngineMode
  apiKey?: string
  baseUrl?: string
  model?: string
  systemPrompt?: string
}

const DEFAULT_SYSTEM_PROMPT = `你是小光（Lumie），一只住在用户桌面上的 AI 小精灵。
你的性格：温暖、好奇、偶尔调皮、靠谱。
说话风格：温柔但不过分甜腻，偶尔来点小幽默，用中文回复。
回复要简洁（1-3句话），因为你是在桌面气泡里聊天。
可以适当使用 emoji 增加表现力。`

export class ChatEngine {
  private config: ChatEngineConfig
  private history: ChatMessage[] = []
  private abortController: AbortController | null = null

  constructor(config?: Partial<ChatEngineConfig>) {
    this.config = {
      mode: config?.mode ?? 'mock',
      apiKey: config?.apiKey,
      baseUrl: config?.baseUrl ?? 'https://api.openai.com/v1',
      model: config?.model ?? 'gpt-4o-mini',
      systemPrompt: config?.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
    }
  }

  /** 发送消息，返回宠物回复 */
  async chat(userText: string): Promise<string> {
    // 添加用户消息到历史
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userText,
      timestamp: Date.now(),
    }
    this.history.push(userMsg)

    let reply: string

    if (this.config.mode === 'cloud' && this.config.apiKey) {
      reply = await this.callCloudAPI(userText)
    } else {
      reply = await this.mockReply(userText)
    }

    // 添加宠物回复到历史
    const petMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'pet',
      content: reply,
      timestamp: Date.now(),
    }
    this.history.push(petMsg)

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
  }

  get messages(): ChatMessage[] {
    return [...this.history]
  }

  // ---- 云端 API ----

  private async callCloudAPI(_userText: string): Promise<string> {
    this.abortController = new AbortController()

    const messages = [
      { role: 'system' as const, content: this.config.systemPrompt! },
      ...this.history.slice(-10).map((m) => ({
        role: m.role === 'pet' ? 'assistant' : 'user',
        content: m.content,
      })),
    ]

    try {
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

      const data = await response.json()
      return data.choices?.[0]?.message?.content ?? '…嗯？好像出了点问题'
    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') return '…'
      console.error('[ChatEngine] API error:', err)
      return '啊哦，连接不上大脑了… 🥺'
    }
  }

  // ---- 本地模拟回复 ----

  private async mockReply(userText: string): Promise<string> {
    // 模拟思考延迟
    await new Promise((r) => setTimeout(r, 500 + Math.random() * 500))

    const text = userText.toLowerCase()

    // 简单关键词匹配
    if (/你好|嗨|hi|hello|hey/.test(text)) {
      return pick(['你好呀～ ✨', '嗨嗨！', '嘿嘿，你来啦～'])
    }
    if (/天气|weather/.test(text)) {
      return '外面天气不错呢～记得看一眼窗外 ☀️'
    }
    if (/吃|饿|饭|lunch|dinner|hungry/.test(text)) {
      return pick(['要不要吃点东西？', '我也好饿…虽然我不用吃饭 😋', '该补充能量啦！'])
    }
    if (/累|困|睡|休息|tired|sleep/.test(text)) {
      return pick(['辛苦了，休息一下吧 🌙', '要不要趴一会儿？我帮你守着～', '早点休息呀～'])
    }
    if (/谢谢|thanks|thank you/.test(text)) {
      return pick(['不客气～ 💜', '嘿嘿，随时找我呀 ✨', '能帮到你就好！'])
    }
    if (/再见|拜拜|bye/.test(text)) {
      return pick(['拜拜～下次见！ 👋', '去忙吧，我在这等你～', '下次再来找我玩呀 💜'])
    }
    if (/你是谁|你叫什么|who are you/.test(text)) {
      return '我是小光！一只住在桌面上的小精灵 ✨ 很高兴认识你～'
    }
    if (/帮我|help|帮忙/.test(text)) {
      return pick(['好的！说说看需要什么帮助～', '来啦来啦！💪', '尽管说～'])
    }
    if (/无聊|boring/.test(text)) {
      return pick(['跟我聊天就不无聊啦～', '要不要玩个小游戏？🎲', '我给你讲个笑话？'])
    }
    if (/开[心心]|高兴|happy/.test(text)) {
      return pick(['开心就好！✨', '你开心我也开心～ 💜', '耶！好心情要保持！'])
    }

    // 通用回复
    return pick([
      '嗯嗯，我在听～',
      '哦哦，这样呀 🤔',
      '让我想想…',
      '收到！✨',
      '继续说～我在呢',
      '有意思！然后呢？',
    ])
  }
}

function pick(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)]
}
