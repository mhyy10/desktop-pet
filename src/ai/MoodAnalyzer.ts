import type { PetMood } from '../pet/types'

// ============================================
// 文本情感分析 — 纯本地关键词匹配
// AI 回复 → 影响宠物心情
// ============================================

interface MoodKeyword {
  mood: PetMood
  keywords: string[]
}

const MOOD_KEYWORDS: MoodKeyword[] = [
  { mood: 'happy', keywords: ['开心', '好的', '太棒了', '不错', '太好了', '哈哈', '喜欢', '爱', '开心', '厉害', '加油', '当然', '没问题', '支持'] },
  { mood: 'excited', keywords: ['超棒', '太厉害', '太爽了', '超开心', '太赞', '完美', '太强了'] },
  { mood: 'bored', keywords: ['难过', '不行', '糟糕', '烦', '讨厌', '伤心', '失望', '累', '辛苦'] },
  { mood: 'angry', keywords: ['生气', '愤怒', '烦死了', '气死', '可恶'] },
  { mood: 'thinking', keywords: ['为什么', '怎么回事', '什么意思', '如何', '怎么', '是否', '也许', '可能'] },
]

/** 分析文本情感，返回匹配的心情或 null（无明显情感） */
export function analyzeMood(text: string): PetMood | null {
  const lower = text.toLowerCase()

  for (const { mood, keywords } of MOOD_KEYWORDS) {
    for (const kw of keywords) {
      if (lower.includes(kw)) return mood
    }
  }

  return null
}
