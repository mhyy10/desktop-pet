import type { ChatMessage } from '../pet/types'

// ============================================
// 会话记忆系统 — 双层架构
// ShortTermMemory: 最近20轮对话（内存）
// LongTermMemory: 历史摘要+关键事实（IndexedDB）
// ============================================

const DB_NAME = 'desktop-pet-memory'
const STORE_NAME = 'memory'
const MAX_SHORT_TERM = 20
const SUMMARY_INTERVAL = 5 // 每5轮生成摘要

interface MemoryRecord {
  key: string
  summary: string
  facts: string[]
  updatedAt: number
}

export class ConversationMemory {
  private shortTerm: ChatMessage[] = []
  private longTermSummary: string = ''
  private longTermFacts: string[] = []
  private roundCount: number = 0

  constructor() {
    this.loadLongTerm()
  }

  /** 添加一条消息到短期记忆 */
  addMessage(msg: ChatMessage): void {
    this.shortTerm.push(msg)
    if (this.shortTerm.length > MAX_SHORT_TERM * 2) {
      // 保留最近20轮（40条消息：user+pet）
      this.shortTerm = this.shortTerm.slice(-MAX_SHORT_TERM * 2)
    }
    if (msg.role === 'pet') {
      this.roundCount++
    }
  }

  /** 获取短期记忆（最近N轮） */
  getShortTerm(): ChatMessage[] {
    return this.shortTerm.slice(-MAX_SHORT_TERM * 2)
  }

  /** 获取长期记忆摘要 */
  getSummary(): string {
    return this.longTermSummary
  }

  /** 获取关键事实 */
  getFacts(): string[] {
    return this.longTermFacts
  }

  /** 是否需要生成摘要 */
  get shouldSummarize(): boolean {
    return this.roundCount >= SUMMARY_INTERVAL
  }

  /** 更新长期记忆摘要 */
  updateSummary(summary: string, facts: string[]): void {
    this.longTermSummary = summary
    this.longTermFacts = [...this.longTermFacts, ...facts].slice(-20) // 最多保留20条事实
    this.roundCount = 0
    this.saveLongTerm()
  }

  /** 构建 AI 上下文：注入记忆到 System Prompt */
  buildContextPrompt(petName: string, mood: string): string {
    let prompt = `你是桌面宠物 ${petName}，性格温暖、好奇、偶尔调皮、靠谱。
说话风格：温柔但不过分甜腻，偶尔来点小幽默，用中文回复。
回复要简洁（1-3句话），因为你是在桌面气泡里聊天。
可以适当使用 emoji 增加表现力。
你现在的心情是 ${mood}，请在回复中体现这个心情。`

    if (this.longTermSummary) {
      prompt += `\n\n[历史摘要] ${this.longTermSummary}`
    }

    if (this.longTermFacts.length > 0) {
      prompt += `\n\n[关于用户的关键事实]\n${this.longTermFacts.map((f) => `- ${f}`).join('\n')}`
    }

    return prompt
  }

  /** 清空所有记忆 */
  clear(): void {
    this.shortTerm = []
    this.longTermSummary = ''
    this.longTermFacts = []
    this.roundCount = 0
    this.saveLongTerm()
  }

  // ---- IndexedDB 持久化 ----

  private async loadLongTerm(): Promise<void> {
    try {
      const db = await this.openDB()
      const record = await this.getRecord(db, 'longterm')
      if (record) {
        this.longTermSummary = record.summary
        this.longTermFacts = record.facts
      }
    } catch {
      // IndexedDB 不可用时静默失败
    }
  }

  private async saveLongTerm(): Promise<void> {
    try {
      const db = await this.openDB()
      await this.setRecord(db, {
        key: 'longterm',
        summary: this.longTermSummary,
        facts: this.longTermFacts,
        updatedAt: Date.now(),
      })
    } catch {
      // 静默失败
    }
  }

  private openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' })
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }

  private getRecord(db: IDBDatabase, key: string): Promise<MemoryRecord | undefined> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(key)
      req.onsuccess = () => resolve(req.result as MemoryRecord | undefined)
      req.onerror = () => reject(req.error)
    })
  }

  private setRecord(db: IDBDatabase, record: MemoryRecord): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const req = tx.objectStore(STORE_NAME).put(record)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  }
}
