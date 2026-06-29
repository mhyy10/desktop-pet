import type { ChatMessage } from '../pet/types'
import type { Fact, FactCategory, FactImportance, MemorySnapshot } from './memoryTypes'
import type { MemoryStorage } from './memoryStorage'
import { decayFacts, retrieveRelevantFacts } from './memoryRetrieval'

// ============================================
// 会话记忆系统 — 双层架构
// ShortTermMemory: 最近20轮对话（内存）
// LongTermMemory: 历史摘要 + 结构化事实库（可注入 MemoryStorage，默认 IndexedDB）
// ============================================

const DB_NAME = 'desktop-pet-memory'
const STORE_NAME = 'memory'
const MAX_SHORT_TERM = 20
const SUMMARY_INTERVAL = 5 // 每5轮生成摘要
const MAX_SUMMARY_SEGMENTS = 3 // 累积摘要最多保留3段
const SUMMARY_SEPARATOR = ' / '
const MAX_FACTS = 50 // 事实库总量上限，超出按衰减策略淘汰 normal 事实

interface LegacyMemoryRecord {
  key: string
  summary: string
  facts: string[] // 旧格式：纯字符串数组
  updatedAt: number
}

export class ConversationMemory {
  private shortTerm: ChatMessage[] = []
  private longTermSummary: string = ''
  private longTermFacts: Fact[] = []
  private roundCount: number = 0
  private storage: MemoryStorage

  constructor(storage?: MemoryStorage) {
    this.storage = storage ?? new IndexedDbMemoryStorage()
    void this.loadLongTerm()
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

  /**
   * 获取关键事实（结构化）。
   * 注意：返回 Fact[]，旧调用方（string[]）需在阶段3适配。
   */
  getFacts(): Fact[] {
    return [...this.longTermFacts]
  }

  /** 获取全部事实（记忆面板用） */
  getAllFacts(): Fact[] {
    return [...this.longTermFacts]
  }

  /** 是否需要生成摘要 */
  get shouldSummarize(): boolean {
    return this.roundCount >= SUMMARY_INTERVAL
  }

  /**
   * 更新长期记忆：累积式摘要（保留最近 N 段） + 事实入库。
   * 入参 facts 为 string[]（来自 LLM 摘要解析），内部归一化去重后转为 Fact 入库。
   */
  updateSummary(summary: string, facts: string[]): void {
    // 累积摘要：新摘要拼到前面，超出 N 段截断尾部
    if (summary) {
      const segments = this.longTermSummary
        ? this.longTermSummary.split(SUMMARY_SEPARATOR)
        : []
      segments.unshift(summary)
      this.longTermSummary = segments.slice(0, MAX_SUMMARY_SEGMENTS).join(SUMMARY_SEPARATOR)
    }

    // 事实入库（去重 + 归一化）
    const now = Date.now()
    for (const content of facts) {
      this.addFactInternal(content, 'other', 'normal', now)
    }

    this.roundCount = 0
    void this.saveLongTerm()
  }

  /**
   * 手动添加事实（记忆面板 / 显式调用）。
   * content 归一化后去重；重复则更新 lastAccessed 并提升 importance（若新值更高）。
   */
  addFact(content: string, category: FactCategory, importance: FactImportance): Fact | null {
    const fact = this.addFactInternal(content, category, importance, Date.now())
    if (fact) void this.saveLongTerm()
    return fact
  }

  /** 更新单条事实 */
  updateFact(id: string, patch: Partial<Omit<Fact, 'id' | 'createdAt'>>): boolean {
    const idx = this.longTermFacts.findIndex((f) => f.id === id)
    if (idx === -1) return false
    this.longTermFacts[idx] = { ...this.longTermFacts[idx], ...patch }
    void this.saveLongTerm()
    return true
  }

  /** 删除单条事实 */
  deleteFact(id: string): boolean {
    const before = this.longTermFacts.length
    this.longTermFacts = this.longTermFacts.filter((f) => f.id !== id)
    const changed = this.longTermFacts.length !== before
    if (changed) void this.saveLongTerm()
    return changed
  }

  /** 仅清空事实（保留摘要） */
  clearFacts(): void {
    this.longTermFacts = []
    void this.saveLongTerm()
  }

  /** 标记事实被命中（检索注入后回写，更新 lastAccessed/hitCount） */
  markFactsHit(ids: string[]): void {
    const now = Date.now()
    let changed = false
    for (const f of this.longTermFacts) {
      if (ids.includes(f.id)) {
        f.lastAccessed = now
        f.hitCount++
        changed = true
      }
    }
    if (changed) void this.saveLongTerm()
  }

  /**
   * 构建 AI 上下文：注入记忆到 System Prompt。
   * - query 提供时：只注入检索相关的 normal 事实 + 全部 permanent 事实，并回写命中事实的 hitCount/lastAccessed
   * - query 缺省时：全量注入所有事实（向后兼容，用于无具体话题的主动对话等场景）
   */
  buildContextPrompt(petName: string, mood: string, query?: string): string {
    let prompt = `你是桌面宠物 ${petName}，性格温暖、好奇、偶尔调皮、靠谱。
说话风格：温柔但不过分甜腻，偶尔来点小幽默，用中文回复。
回复要简洁（1-3句话），因为你是在桌面气泡里聊天。
可以适当使用 emoji 增加表现力。
你现在的心情是 ${mood}，请在回复中体现这个心情。`

    if (this.longTermSummary) {
      prompt += `\n\n[历史摘要] ${this.longTermSummary}`
    }

    // 选取要注入的事实：有 query 走检索，无 query 全量
    const factsToInject =
      query !== undefined
        ? retrieveRelevantFacts(query, this.longTermFacts, { topK: 5, minScore: 1 })
        : this.longTermFacts

    if (query !== undefined && factsToInject.length > 0) {
      // 回写命中事实的访问统计（影响后续衰减排序）
      this.markFactsHit(factsToInject.map((f) => f.id))
    }

    if (factsToInject.length > 0) {
      prompt += `\n\n[关于用户的关键事实]\n${factsToInject
        .map((f) => `- ${f.content}`)
        .join('\n')}`
    }

    return prompt
  }

  /** 清空所有记忆 */
  clear(): void {
    this.shortTerm = []
    this.longTermSummary = ''
    this.longTermFacts = []
    this.roundCount = 0
    void this.saveLongTerm()
  }

  // ---- 事实入库内部实现（去重 + 归一化），不主动持久化 ----

  private addFactInternal(
    content: string,
    category: FactCategory,
    importance: FactImportance,
    now: number,
  ): Fact | null {
    const normalized = normalizeFactContent(content)
    if (!normalized) return null

    const existing = this.longTermFacts.find(
      (f) => normalizeFactContent(f.content) === normalized,
    )
    if (existing) {
      // 已存在：刷新访问时间；若新重要性更高则升级（normal → permanent）
      existing.lastAccessed = now
      if (importance === 'permanent' && existing.importance !== 'permanent') {
        existing.importance = 'permanent'
      }
      return existing
    }

    const fact: Fact = {
      id: generateFactId(),
      content: normalized,
      category,
      importance,
      createdAt: now,
      lastAccessed: now,
      hitCount: 0,
    }
    this.longTermFacts.push(fact)
    // 超出总量上限时淘汰末尾 normal 事实（permanent 永不淘汰）
    if (this.longTermFacts.length > MAX_FACTS) {
      this.longTermFacts = decayFacts(this.longTermFacts, MAX_FACTS, now)
    }
    return fact
  }

  // ---- 持久化（委托 storage） ----

  private async loadLongTerm(): Promise<void> {
    try {
      const snapshot = await this.storage.load()
      if (snapshot) {
        this.longTermSummary = snapshot.summary
        // 迁移责任在消费侧：无论哪个 storage 实现，旧格式 string[] 都在此归一化为 Fact[]
        this.longTermFacts = migrateLegacyFacts(snapshot.facts)
      }
    } catch {
      // 存储不可用时静默失败
    }
  }

  private async saveLongTerm(): Promise<void> {
    try {
      await this.storage.save({
        key: 'longterm',
        summary: this.longTermSummary,
        facts: this.longTermFacts,
        updatedAt: Date.now(),
      })
    } catch {
      // 静默失败
    }
  }
}

// ============================================
// 工具函数
// ============================================

/** 归一化事实内容：去首尾空白、合并连续空白，便于去重比对 */
export function normalizeFactContent(content: string): string {
  return content.replace(/\s+/g, ' ').trim()
}

/** 生成事实 ID（crypto.randomUUID 不可用时回退） */
function generateFactId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `fact_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

// ============================================
// IndexedDB 存储（默认实现）
// 负责真实浏览器持久化 + 旧格式数据迁移
// ============================================

class IndexedDbMemoryStorage implements MemoryStorage {
  async load(): Promise<MemorySnapshot | undefined> {
    const db = await this.openDB()
    const record = await this.getRecord(db, 'longterm')
    if (!record) return undefined

    // 原样返回（facts 可能是旧格式 string[]），由 ConversationMemory.loadLongTerm 统一迁移
    return {
      key: 'longterm',
      summary: record.summary ?? '',
      facts: (record.facts ?? []) as unknown as Fact[],
      updatedAt: record.updatedAt ?? Date.now(),
    }
  }

  async save(snapshot: MemorySnapshot): Promise<void> {
    const db = await this.openDB()
    await this.setRecord(db, snapshot)
  }

  private openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 2)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' })
        }
        // version 1→2：store 结构不变（仍是 keyPath:'key' 的单 store），
        // facts 字段在读取时按需迁移，无需建新 store
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }

  private getRecord(db: IDBDatabase, key: string): Promise<LegacyMemoryRecord | MemorySnapshot | undefined> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(key)
      req.onsuccess = () => resolve(req.result as LegacyMemoryRecord | MemorySnapshot | undefined)
      req.onerror = () => reject(req.error)
    })
  }

  private setRecord(db: IDBDatabase, record: MemorySnapshot): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const req = tx.objectStore(STORE_NAME).put(record)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  }
}

/**
 * 迁移旧格式事实：string[] → Fact[]。
 * - 字符串数组：每条转为 category='other', importance='normal' 的 Fact
 * - 已是 Fact[]：原样返回
 * - 缺失/其他：空数组
 */
export function migrateLegacyFacts(facts: unknown): Fact[] {
  if (!Array.isArray(facts)) return []
  return facts.map((f, i) => {
    if (typeof f === 'string') {
      const now = Date.now()
      return {
        id: `legacy_${i}_${Math.random().toString(36).slice(2, 8)}`,
        content: normalizeFactContent(f),
        category: 'other' as FactCategory,
        importance: 'normal' as FactImportance,
        createdAt: now,
        lastAccessed: now,
        hitCount: 0,
      }
    }
    return f as Fact
  })
}
