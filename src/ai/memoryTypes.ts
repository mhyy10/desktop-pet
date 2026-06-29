// ============================================
// 记忆系统 — 结构化数据模型
// 取代旧的 string[] 事实库，支持分类/重要性/检索/衰减
// ============================================

/** 事实分类 */
export type FactCategory = 'identity' | 'preference' | 'event' | 'relation' | 'other'

/**
 * 事实重要性
 * - permanent: 永久级（如用户名字），永不被衰减淘汰，检索时必注入
 * - normal: 普通级，按命中数/新鲜度参与衰减淘汰
 */
export type FactImportance = 'permanent' | 'normal'

/** 单条结构化事实 */
export interface Fact {
  id: string
  content: string
  category: FactCategory
  importance: FactImportance
  createdAt: number
  lastAccessed: number
  hitCount: number
}

/** 长期记忆快照（IndexedDB 持久化结构） */
export interface MemorySnapshot {
  key: 'longterm'
  summary: string
  facts: Fact[]
  updatedAt: number
}

/** 事实分类 → 显示名 */
export const FACT_CATEGORY_LABELS: Record<FactCategory, string> = {
  identity: '身份',
  preference: '偏好',
  event: '事件',
  relation: '关系',
  other: '其他',
}

/** 事实重要性 → 显示名 */
export const FACT_IMPORTANCE_LABELS: Record<FactImportance, string> = {
  permanent: '永久',
  normal: '普通',
}
