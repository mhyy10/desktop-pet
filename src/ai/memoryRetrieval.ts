import type { Fact } from './memoryTypes'

// ============================================
// 记忆检索与衰减 — 纯函数（无副作用，可单测）
// 检索策略：本地关键词重叠打分（中文 2-gram + 英文分词），不调用 LLM
// 衰减策略：permanent 永不淘汰；normal 按 (hitCount 权重 + 新鲜度) 排序截断
// ============================================

const DEFAULT_TOP_K = 5
const DEFAULT_MIN_SCORE = 1

/**
 * 分词：中文按 2-gram（连续两个字符），英文/数字按空格与标点切分并小写化。
 * 混合文本中，CJK 段走 2-gram，非 CJK 段走词切分。
 */
export function tokenize(text: string): string[] {
  const cleaned = text.trim()
  if (!cleaned) return []

  const tokens = new Set<string>()
  // 按空白与标点切分成段，保留 CJK 连续片段
  const segments = cleaned.split(/[\s\p{P}\p{S}]+/u).filter(Boolean)

  for (const seg of segments) {
    if (containsCjk(seg)) {
      // CJK 段：单字 + 2-gram。单字让短 query（如"狗"）能命中，2-gram 提供区分度
      for (let i = 0; i < seg.length; i++) {
        tokens.add(seg[i])
        if (i < seg.length - 1) tokens.add(seg.slice(i, i + 2))
      }
    } else {
      // 非 CJK 段：整词小写
      tokens.add(seg.toLowerCase())
    }
  }

  return [...tokens]
}

/** 是否包含 CJK 字符（中日韩统一表意文字 + 扩展A区） */
function containsCjk(s: string): boolean {
  return /[一-鿿㐀-䶿]/.test(s)
}

/**
 * 计算单条事实相对 query 的命中分数（重叠 token 数）。
 */
function scoreFact(queryTokens: string[], fact: Fact): number {
  if (queryTokens.length === 0) return 0
  const factTokens = new Set(tokenize(fact.content))
  let score = 0
  for (const t of queryTokens) {
    if (factTokens.has(t)) score++
  }
  return score
}

/**
 * 检索与 query 相关的事实。
 * - 全部 permanent 事实无条件返回
 * - normal 事实按命中分数排序，取 topK 条且分数 >= minScore
 * - permanent 不计入 topK 配额
 * 返回新数组，不修改入参。
 */
export function retrieveRelevantFacts(
  query: string,
  facts: Fact[],
  options: { topK?: number; minScore?: number } = {},
): Fact[] {
  const topK = options.topK ?? DEFAULT_TOP_K
  const minScore = options.minScore ?? DEFAULT_MIN_SCORE

  const permanent = facts.filter((f) => f.importance === 'permanent')
  const normal = facts.filter((f) => f.importance !== 'permanent')

  const queryTokens = tokenize(query)
  const scored = normal
    .map((f) => ({ fact: f, score: scoreFact(queryTokens, f) }))
    .filter((x) => x.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((x) => x.fact)

  return [...permanent, ...scored]
}

/**
 * 衰减淘汰：控制事实库总量。
 * - permanent 永不淘汰
 * - normal 按 (hitCount 主 + 新鲜度辅) 降序排序，保留前 (maxFacts - permanentCount) 条
 * - 新鲜度由 now 与 lastAccessed 计算：越久未访问越靠后
 * 返回新数组，不修改入参。
 */
export function decayFacts(facts: Fact[], maxFacts: number, now: number): Fact[] {
  const permanent = facts.filter((f) => f.importance === 'permanent')
  const normal = facts.filter((f) => f.importance !== 'permanent')

  // permanent 已占的名额
  const normalQuota = Math.max(0, maxFacts - permanent.length)
  if (normal.length <= normalQuota) {
    return [...permanent, ...normal]
  }

  const DAY = 86_400_000
  const sortedNormal = [...normal].sort((a, b) => {
    // hitCount 高的优先
    if (b.hitCount !== a.hitCount) return b.hitCount - a.hitCount
    // 同 hitCount：新鲜度高（距 now 更近）的优先
    const freshnessA = 1 / (1 + (now - a.lastAccessed) / DAY)
    const freshnessB = 1 / (1 + (now - b.lastAccessed) / DAY)
    return freshnessB - freshnessA
  })

  return [...permanent, ...sortedNormal.slice(0, normalQuota)]
}
