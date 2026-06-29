import { describe, it, expect } from 'vitest'
import { ConversationMemory, normalizeFactContent, migrateLegacyFacts } from './ConversationMemory'
import { InMemoryStorage } from './memoryStorage'
import type { MemorySnapshot } from './memoryTypes'

// ============================================
// 阶段0 验证：可注入存储抽象 + 结构化事实 CRUD + 旧格式迁移
// ============================================

describe('normalizeFactContent', () => {
  it('去首尾空白并合并连续空白', () => {
    expect(normalizeFactContent('  用户   喜欢吃  面条  ')).toBe('用户 喜欢吃 面条')
  })

  it('空串归一化为空', () => {
    expect(normalizeFactContent('   ')).toBe('')
  })
})

describe('migrateLegacyFacts', () => {
  it('string[] 转为 Fact[]，category=other importance=normal', () => {
    const result = migrateLegacyFacts(['用户叫小明', '喜欢猫'])
    expect(result).toHaveLength(2)
    expect(result[0].content).toBe('用户叫小明')
    expect(result[0].category).toBe('other')
    expect(result[0].importance).toBe('normal')
    expect(result[0].id).toBeTruthy()
  })

  it('已是 Fact[] 原样返回', () => {
    const facts = [
      {
        id: 'x1',
        content: '测试',
        category: 'identity' as const,
        importance: 'permanent' as const,
        createdAt: 1,
        lastAccessed: 1,
        hitCount: 0,
      },
    ]
    expect(migrateLegacyFacts(facts)).toEqual(facts)
  })

  it('非数组返回空数组', () => {
    expect(migrateLegacyFacts(undefined)).toEqual([])
    expect(migrateLegacyFacts(null)).toEqual([])
  })
})

describe('ConversationMemory CRUD（InMemoryStorage）', () => {
  it('addFact 入库并可通过 getAllFacts 读取', () => {
    const mem = new ConversationMemory(new InMemoryStorage())
    const fact = mem.addFact('用户叫小明', 'identity', 'permanent')
    expect(fact).not.toBeNull()
    expect(fact!.content).toBe('用户叫小明')
    expect(fact!.category).toBe('identity')
    expect(fact!.importance).toBe('permanent')
    expect(mem.getAllFacts()).toHaveLength(1)
  })

  it('addFact 归一化去重：相同内容不重复入库', () => {
    const mem = new ConversationMemory(new InMemoryStorage())
    mem.addFact('  用户  叫小明 ', 'identity', 'permanent')
    mem.addFact('用户 叫小明', 'other', 'normal')
    expect(mem.getAllFacts()).toHaveLength(1)
    // 重复时若新 importance 更高则升级
    expect(mem.getAllFacts()[0].importance).toBe('permanent')
  })

  it('addFact 空内容返回 null 不入库', () => {
    const mem = new ConversationMemory(new InMemoryStorage())
    expect(mem.addFact('   ', 'other', 'normal')).toBeNull()
    expect(mem.getAllFacts()).toHaveLength(0)
  })

  it('updateFact 更新指定字段', () => {
    const mem = new ConversationMemory(new InMemoryStorage())
    const fact = mem.addFact('喜欢猫', 'other', 'normal')!
    const ok = mem.updateFact(fact.id, { importance: 'permanent', category: 'preference' })
    expect(ok).toBe(true)
    const updated = mem.getAllFacts().find((f) => f.id === fact.id)!
    expect(updated.importance).toBe('permanent')
    expect(updated.category).toBe('preference')
  })

  it('updateFact 不存在的 id 返回 false', () => {
    const mem = new ConversationMemory(new InMemoryStorage())
    expect(mem.updateFact('nope', { importance: 'permanent' })).toBe(false)
  })

  it('deleteFact 删除指定事实', () => {
    const mem = new ConversationMemory(new InMemoryStorage())
    const f1 = mem.addFact('事实1', 'other', 'normal')!
    mem.addFact('事实2', 'other', 'normal')
    expect(mem.deleteFact(f1.id)).toBe(true)
    expect(mem.getAllFacts()).toHaveLength(1)
    expect(mem.getAllFacts()[0].content).toBe('事实2')
  })

  it('clearFacts 清空事实但保留摘要', () => {
    const mem = new ConversationMemory(new InMemoryStorage())
    mem.addFact('事实1', 'other', 'normal')
    mem.updateSummary('一段摘要', [])
    mem.clearFacts()
    expect(mem.getAllFacts()).toHaveLength(0)
    expect(mem.getSummary()).toBe('一段摘要')
  })

  it('markFactsHit 更新命中事实的 lastAccessed 和 hitCount', () => {
    const mem = new ConversationMemory(new InMemoryStorage())
    const f1 = mem.addFact('事实1', 'other', 'normal')!
    const f2 = mem.addFact('事实2', 'other', 'normal')!
    const before = f1.hitCount
    mem.markFactsHit([f1.id])
    const after = mem.getAllFacts().find((f) => f.id === f1.id)!
    expect(after.hitCount).toBe(before + 1)
    const untouched = mem.getAllFacts().find((f) => f.id === f2.id)!
    expect(untouched.hitCount).toBe(0)
  })
})

describe('ConversationMemory 持久化（InMemoryStorage）', () => {
  it('写入后通过同一 storage 重建可恢复事实与摘要', async () => {
    const storage = new InMemoryStorage()
    const mem1 = new ConversationMemory(storage)
    mem1.addFact('用户叫小红', 'identity', 'permanent')
    mem1.updateSummary('关于小红的摘要', [])

    // 等待异步 saveLongTerm 完成
    await new Promise((r) => setTimeout(r, 0))

    const mem2 = new ConversationMemory(storage)
    await new Promise((r) => setTimeout(r, 0)) // 等待 loadLongTerm

    expect(mem2.getSummary()).toBe('关于小红的摘要')
    expect(mem2.getAllFacts()).toHaveLength(1)
    expect(mem2.getAllFacts()[0].content).toBe('用户叫小红')
  })

  it('可预置旧格式快照，加载时自动迁移为 Fact[]', async () => {
    const legacySnapshot: MemorySnapshot = {
      key: 'longterm',
      summary: '旧摘要',
      facts: migrateLegacyFacts(['旧事实1', '旧事实2']),
      updatedAt: 1000,
    }
    // 模拟真实旧数据：facts 为 string[]
    const legacyRaw = {
      key: 'longterm',
      summary: '旧摘要',
      facts: ['旧事实1', '旧事实2'] as unknown as MemorySnapshot['facts'],
      updatedAt: 1000,
    }
    void legacySnapshot
    const storage = new InMemoryStorage(legacyRaw as MemorySnapshot)
    const mem = new ConversationMemory(storage)
    await new Promise((r) => setTimeout(r, 0))

    const facts = mem.getAllFacts()
    expect(facts).toHaveLength(2)
    expect(facts[0].content).toBe('旧事实1')
    expect(facts[0].category).toBe('other')
    expect(facts[0].importance).toBe('normal')
  })
})

describe('ConversationMemory 摘要累积', () => {
  it('多次 updateSummary 保留最近 N 段（不覆盖）', () => {
    const mem = new ConversationMemory(new InMemoryStorage())
    mem.updateSummary('摘要A', [])
    mem.updateSummary('摘要B', [])
    mem.updateSummary('摘要C', [])
    const summary = mem.getSummary()
    expect(summary).toContain('摘要C')
    expect(summary).toContain('摘要B')
    expect(summary).toContain('摘要A')
  })

  it('超过 N 段截断最旧的', () => {
    const mem = new ConversationMemory(new InMemoryStorage())
    for (let i = 0; i < 6; i++) {
      mem.updateSummary(`摘要${i}`, [])
    }
    const summary = mem.getSummary()
    expect(summary).toContain('摘要5')
    expect(summary).not.toContain('摘要0')
  })

  it('updateSummary 的 facts 入库', () => {
    const mem = new ConversationMemory(new InMemoryStorage())
    mem.updateSummary('摘要', ['用户喜欢狗', '用户是程序员'])
    expect(mem.getAllFacts()).toHaveLength(2)
  })
})

describe('ConversationMemory 事实衰减集成', () => {
  it('超过 MAX_FACTS(50) 时淘汰末尾 normal 事实', () => {
    const mem = new ConversationMemory(new InMemoryStorage())
    // 加 55 条 normal 事实，应被截断到 50
    for (let i = 0; i < 55; i++) {
      mem.addFact(`普通事实${i}`, 'other', 'normal')
    }
    expect(mem.getAllFacts()).toHaveLength(50)
  })

  it('permanent 事实不计入淘汰，超量时仍全部保留', () => {
    const mem = new ConversationMemory(new InMemoryStorage())
    // 5 条 permanent + 55 条 normal
    for (let i = 0; i < 5; i++) {
      mem.addFact(`永久事实${i}`, 'identity', 'permanent')
    }
    for (let i = 0; i < 55; i++) {
      mem.addFact(`普通事实${i}`, 'other', 'normal')
    }
    const all = mem.getAllFacts()
    expect(all).toHaveLength(50)
    // 5 条 permanent 全在
    const permanents = all.filter((f) => f.importance === 'permanent')
    expect(permanents).toHaveLength(5)
    // normal 被压缩到 45 条
    expect(all.filter((f) => f.importance === 'normal')).toHaveLength(45)
  })
})
