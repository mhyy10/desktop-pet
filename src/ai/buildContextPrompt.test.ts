import { describe, it, expect } from 'vitest'
import { ConversationMemory } from './ConversationMemory'
import { InMemoryStorage } from './memoryStorage'

// ============================================
// 阶段2: buildContextPrompt 检索注入（TDD）
// 验证：query 提供时只注入相关 normal 事实 + 全部 permanent；不提供时全量注入（向后兼容）
// ============================================

describe('buildContextPrompt 检索注入', () => {
  it('无 query 时全量注入所有事实（向后兼容）', () => {
    const mem = new ConversationMemory(new InMemoryStorage())
    mem.addFact('用户喜欢狗', 'preference', 'normal')
    mem.addFact('用户是程序员', 'event', 'normal')
    mem.addFact('用户叫小明', 'identity', 'permanent')

    const prompt = mem.buildContextPrompt('小光', 'happy')
    expect(prompt).toContain('用户喜欢狗')
    expect(prompt).toContain('用户是程序员')
    expect(prompt).toContain('用户叫小明')
  })

  it('有 query 时只注入相关 normal 事实 + 全部 permanent', () => {
    const mem = new ConversationMemory(new InMemoryStorage())
    mem.addFact('用户喜欢狗', 'preference', 'normal')
    mem.addFact('用户是程序员', 'event', 'normal')
    mem.addFact('用户叫小明', 'identity', 'permanent')

    // query 关于"狗"，应注入"用户喜欢狗"+"用户叫小明"(permanent)，不注入"程序员"
    const prompt = mem.buildContextPrompt('小光', 'happy', '我想养狗')
    expect(prompt).toContain('用户喜欢狗')
    expect(prompt).toContain('用户叫小明') // permanent 必注入
    expect(prompt).not.toContain('用户是程序员')
  })

  it('有 query 但无相关 normal 事实时，仍注入 permanent', () => {
    const mem = new ConversationMemory(new InMemoryStorage())
    mem.addFact('用户喜欢狗', 'preference', 'normal')
    mem.addFact('用户叫小明', 'identity', 'permanent')

    const prompt = mem.buildContextPrompt('小光', 'happy', '今天天气真好')
    expect(prompt).toContain('用户叫小明')
    expect(prompt).not.toContain('用户喜欢狗')
  })

  it('无事实时不包含 [关于用户的关键事实] 段', () => {
    const mem = new ConversationMemory(new InMemoryStorage())
    const prompt = mem.buildContextPrompt('小光', 'happy', '你好')
    expect(prompt).not.toContain('关键事实')
  })

  it('摘要始终注入（若存在）', () => {
    const mem = new ConversationMemory(new InMemoryStorage())
    mem.updateSummary('昨天聊了工作', [])
    const prompt = mem.buildContextPrompt('小光', 'happy', '你好')
    expect(prompt).toContain('昨天聊了工作')
    expect(prompt).toContain('[历史摘要]')
  })

  it('注入 petName 和 mood', () => {
    const mem = new ConversationMemory(new InMemoryStorage())
    const prompt = mem.buildContextPrompt('豆豆', 'excited')
    expect(prompt).toContain('豆豆')
    expect(prompt).toContain('excited')
  })

  it('检索命中后回写 hitCount/lastAccessed（通过 markFactsHit）', () => {
    const mem = new ConversationMemory(new InMemoryStorage())
    const f = mem.addFact('用户喜欢狗', 'preference', 'normal')!
    const before = f.hitCount
    // buildContextPrompt 内部检索后应调用 markFactsHit 回写命中的 normal 事实
    mem.buildContextPrompt('小光', 'happy', '狗')
    const after = mem.getAllFacts().find((x) => x.id === f.id)!
    expect(after.hitCount).toBe(before + 1)
  })

  it('permanent 事实命中也计入 hitCount', () => {
    const mem = new ConversationMemory(new InMemoryStorage())
    const f = mem.addFact('用户叫小明', 'identity', 'permanent')!
    const before = f.hitCount
    mem.buildContextPrompt('小光', 'happy', '小明')
    const after = mem.getAllFacts().find((x) => x.id === f.id)!
    expect(after.hitCount).toBe(before + 1)
  })

  it('未命中的 normal 事实 hitCount 不变', () => {
    const mem = new ConversationMemory(new InMemoryStorage())
    const hit = mem.addFact('用户喜欢狗', 'preference', 'normal')!
    const miss = mem.addFact('用户是程序员', 'event', 'normal')!
    mem.buildContextPrompt('小光', 'happy', '狗')
    const afterHit = mem.getAllFacts().find((x) => x.id === hit.id)!
    const afterMiss = mem.getAllFacts().find((x) => x.id === miss.id)!
    expect(afterHit.hitCount).toBe(1)
    expect(afterMiss.hitCount).toBe(0)
  })
})
