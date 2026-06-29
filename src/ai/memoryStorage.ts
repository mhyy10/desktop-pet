import type { MemorySnapshot } from './memoryTypes'

// ============================================
// 记忆存储抽象 — 解耦 ConversationMemory 与 IndexedDB
// 真实环境用 IndexedDbMemoryStorage；测试用 InMemoryStorage（无浏览器依赖）
// ============================================

/** 存储接口：只暴露 ConversationMemory 需要的 load/save 两个操作 */
export interface MemoryStorage {
  load(): Promise<MemorySnapshot | undefined>
  save(snapshot: MemorySnapshot): Promise<void>
}

/**
 * 内存存储 — 测试用。线程内同步语义（包成 Promise 以匹配接口）。
 * 可预置快照用于迁移测试。
 */
export class InMemoryStorage implements MemoryStorage {
  private record: MemorySnapshot | undefined

  constructor(initial?: MemorySnapshot) {
    this.record = initial
  }

  async load(): Promise<MemorySnapshot | undefined> {
    return this.record ? { ...this.record, facts: [...this.record.facts] } : undefined
  }

  async save(snapshot: MemorySnapshot): Promise<void> {
    this.record = { ...snapshot, facts: [...snapshot.facts] }
  }

  /** 测试辅助：直接窥探内部存储 */
  peek(): MemorySnapshot | undefined {
    return this.record
  }
}
