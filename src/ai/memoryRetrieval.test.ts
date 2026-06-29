import { describe, it, expect } from 'vitest'
import { retrieveRelevantFacts, decayFacts, tokenize } from './memoryRetrieval'
import type { Fact } from './memoryTypes'

// 固定时间戳避免测试时间漂移
const NOW = 1_700_000_000_000

function makeFact(
  overrides: Partial<Fact> & { content: string },
): Fact {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    content: overrides.content,
    category: overrides.category ?? 'other',
    importance: overrides.importance ?? 'normal',
    createdAt: overrides.createdAt ?? NOW,
    lastAccessed: overrides.lastAccessed ?? NOW,
    hitCount: overrides.hitCount ?? 0,
  }
}

// ============================================
// 分词
// ============================================
describe('tokenize', () => {
  it('中文按 2-gram 分词', () => {
    const tokens = tokenize('我喜欢猫')
    expect(tokens).toContain('我爱'.replace('爱', '喜')) // '我喜'
    expect(tokens).toContain('喜欢')
    expect(tokens).toContain('欢猫')
  })

  it('英文按空格分词并小写化', () => {
    const tokens = tokenize('I Love Cats')
    expect(tokens).toContain('i')
    expect(tokens).toContain('love')
    expect(tokens).toContain('cats')
  })

  it('中英混合都处理', () => {
    const tokens = tokenize('用 React 写代码')
    expect(tokens.some((t) => t.includes('react'))).toBe(true)
    expect(tokens.some((t) => t.includes('代码'))).toBe(true)
  })

  it('空串/纯标点返回空数组', () => {
    expect(tokenize('')).toEqual([])
    expect(tokenize('   ')).toEqual([])
    expect(tokenize('！？。')).toEqual([])
  })
})

// ============================================
// 检索
// ============================================
describe('retrieveRelevantFacts', () => {
  it('按关键词命中打分排序，返回 topK', () => {
    const facts = [
      makeFact({ id: 'f1', content: '用户喜欢吃面条' }),
      makeFact({ id: 'f2', content: '用户养了一只猫' }),
      makeFact({ id: 'f3', content: '用户是程序员，写代码' }),
    ]
    const result = retrieveRelevantFacts('今天吃什么面条', facts, { topK: 2 })
    // f1 命中"面条"，应排第一
    expect(result.map((f) => f.id)).toEqual(['f1'])
    // 只有 f1 命中，topK=2 也只返回 1 条
    expect(result).toHaveLength(1)
  })

  it('无任何命中时返回空数组（无 permanent 时）', () => {
    const facts = [makeFact({ id: 'f1', content: '用户养了一只猫' })]
    const result = retrieveRelevantFacts('今天天气真好', facts)
    expect(result).toEqual([])
  })

  it('permanent 事实无论是否命中都返回', () => {
    const facts = [
      makeFact({ id: 'p1', content: '用户叫小明', importance: 'permanent' }),
      makeFact({ id: 'n1', content: '用户喜欢狗', importance: 'normal' }),
    ]
    // query 与两条都不相关
    const result = retrieveRelevantFacts('今天天气真好', facts)
    expect(result.map((f) => f.id)).toEqual(['p1'])
  })

  it('permanent + 命中的 normal 一起返回', () => {
    const facts = [
      makeFact({ id: 'p1', content: '用户叫小明', importance: 'permanent' }),
      makeFact({ id: 'n1', content: '用户喜欢狗', importance: 'normal' }),
      makeFact({ id: 'n2', content: '用户是程序员', importance: 'normal' }),
    ]
    const result = retrieveRelevantFacts('我想养狗', facts, { topK: 5 })
    const ids = result.map((f) => f.id)
    expect(ids).toContain('p1') // permanent 必在
    expect(ids).toContain('n1') // 命中"狗"
    expect(ids).not.toContain('n2') // 不相关
  })

  it('topK 截断命中的 normal 事实（不含 permanent 计数）', () => {
    const facts = [
      makeFact({ id: 'p1', content: '用户叫小明', importance: 'permanent' }),
      makeFact({ id: 'n1', content: '面条 面条', importance: 'normal' }),
      makeFact({ id: 'n2', content: '吃面条好', importance: 'normal' }),
      makeFact({ id: 'n3', content: '面条真好吃', importance: 'normal' }),
    ]
    // topK=2：permanent 必返回 + 最多 2 条命中 normal
    const result = retrieveRelevantFacts('面条', facts, { topK: 2 })
    const normalHits = result.filter((f) => f.importance === 'normal')
    expect(normalHits.length).toBeLessThanOrEqual(2)
    expect(result.some((f) => f.id === 'p1')).toBe(true)
  })

  it('minScore 过滤低分命中', () => {
    const facts = [makeFact({ id: 'f1', content: '用户喜欢狗' })]
    // "狗" 命中一次，score=1，minScore=2 应过滤掉
    const result = retrieveRelevantFacts('狗', facts, { minScore: 2 })
    expect(result).toEqual([])
    // minScore=1 应保留
    const result2 = retrieveRelevantFacts('狗', facts, { minScore: 1 })
    expect(result2.map((f) => f.id)).toEqual(['f1'])
  })

  it('空 query 返回全部 permanent（无 normal 命中）', () => {
    const facts = [
      makeFact({ id: 'p1', content: '用户叫小明', importance: 'permanent' }),
      makeFact({ id: 'n1', content: '用户喜欢狗', importance: 'normal' }),
    ]
    const result = retrieveRelevantFacts('', facts)
    expect(result.map((f) => f.id)).toEqual(['p1'])
  })

  it('空 facts 返回空数组', () => {
    expect(retrieveRelevantFacts('任何词', [])).toEqual([])
  })

  it('返回的是新数组，不修改原 facts', () => {
    const facts = [makeFact({ id: 'p1', content: '用户叫小明', importance: 'permanent' })]
    const result = retrieveRelevantFacts('你好', facts)
    expect(result).not.toBe(facts)
  })
})

// ============================================
// 衰减
// ============================================
describe('decayFacts', () => {
  it('permanent 事实永不被淘汰', () => {
    const facts = [
      makeFact({ id: 'p1', content: '用户叫小明', importance: 'permanent', hitCount: 0, lastAccessed: NOW - 999_999 }),
    ]
    // maxFacts=1 也不会淘汰 permanent
    const result = decayFacts(facts, 1, NOW)
    expect(result.map((f) => f.id)).toEqual(['p1'])
  })

  it('未超 maxFacts 不淘汰', () => {
    const facts = [
      makeFact({ id: 'n1', content: '事实1', importance: 'normal', hitCount: 5 }),
      makeFact({ id: 'n2', content: '事实2', importance: 'normal', hitCount: 1 }),
    ]
    const result = decayFacts(facts, 10, NOW)
    expect(result).toHaveLength(2)
  })

  it('超 maxFacts 淘汰末尾 normal 事实（按 hitCount+新鲜度排序）', () => {
    const facts = [
      makeFact({ id: 'n1', content: '低命中旧', importance: 'normal', hitCount: 0, lastAccessed: NOW - 10_000 }),
      makeFact({ id: 'n2', content: '高命中新', importance: 'normal', hitCount: 10, lastAccessed: NOW }),
      makeFact({ id: 'n3', content: '中命中', importance: 'normal', hitCount: 3, lastAccessed: NOW - 1000 }),
      makeFact({ id: 'p1', content: '永久', importance: 'permanent', hitCount: 0 }),
    ]
    // maxFacts=2：保留 2 条。permanent 必留(p1)，再加最高分的 normal(n2)
    const result = decayFacts(facts, 2, NOW)
    const ids = result.map((f) => f.id)
    expect(ids).toContain('p1')
    expect(ids).toContain('n2') // hitCount 最高
    expect(ids).not.toContain('n1') // 最低分被淘汰
  })

  it('hitCount 相同时，lastAccessed 更新的优先保留', () => {
    const facts = [
      makeFact({ id: 'old', content: '旧', importance: 'normal', hitCount: 1, lastAccessed: NOW - 50_000 }),
      makeFact({ id: 'new', content: '新', importance: 'normal', hitCount: 1, lastAccessed: NOW }),
    ]
    const result = decayFacts(facts, 1, NOW)
    expect(result.map((f) => f.id)).toEqual(['new'])
  })

  it('全部是 normal 且都重要程度相同时按分数截断', () => {
    const facts = Array.from({ length: 5 }, (_, i) =>
      makeFact({ id: `n${i}`, content: `事实${i}`, importance: 'normal', hitCount: i, lastAccessed: NOW }),
    )
    const result = decayFacts(facts, 3, NOW)
    expect(result).toHaveLength(3)
    // hitCount 最高的 n4 必留
    expect(result.map((f) => f.id)).toContain('n4')
  })

  it('空 facts 返回空数组', () => {
    expect(decayFacts([], 10, NOW)).toEqual([])
  })
})
