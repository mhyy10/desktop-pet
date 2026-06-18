import type { PetMood } from '../pet/types'

// ============================================
// 心情指示器 — 右上角心情点 + 文字
// ============================================

const MOOD_COLORS: Record<PetMood, string> = {
  happy: '#FDCB6E', idle: '#74B9FF', bored: '#A29BFE', sleeping: '#636E72',
  excited: '#00B894', shy: '#FD79A8', angry: '#E17055', thinking: '#0984E3',
  surprised: '#FFEAA7',
}

const MOOD_LABELS: Record<PetMood, string> = {
  happy: '开心', idle: '平静', bored: '无聊', sleeping: '打盹',
  excited: '兴奋', shy: '害羞', angry: '生气', thinking: '思考',
  surprised: '惊讶',
}

interface MoodIndicatorProps {
  mood: PetMood
}

export function MoodIndicator({ mood }: MoodIndicatorProps) {
  return (
    <div className="mood-indicator">
      <span className="mood-dot" style={{ background: MOOD_COLORS[mood] }} />
      <span className="mood-text">{MOOD_LABELS[mood]}</span>
    </div>
  )
}
