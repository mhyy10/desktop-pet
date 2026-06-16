import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import { ChatEngine } from '../ai'

interface TranslatePanelProps {
  chatEngine: ChatEngine
  onClose: () => void
}

export function TranslatePanel({ chatEngine, onClose }: TranslatePanelProps) {
  const [input, setInput] = useState('')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [direction, setDirection] = useState<'zh2en' | 'en2zh'>('zh2en')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleTranslate = async () => {
    const text = input.trim()
    if (!text || loading) return
    setLoading(true)
    setResult('')

    // 自动检测方向：如果输入主要是英文则英→中
    const dir = /[a-zA-Z]/.test(text) && !/[一-鿿]/.test(text)
      ? 'en2zh'
      : direction

    try {
      const translated = await chatEngine.translate(text, dir)
      setResult(translated)
    } catch {
      setResult('翻译出错了，稍后再试 🥺')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') handleTranslate()
    if (e.key === 'Escape') onClose()
  }

  const toggleDirection = () => {
    setDirection((d) => (d === 'zh2en' ? 'en2zh' : 'zh2en'))
  }

  return (
    <>
      <div className="tool-panel-overlay" onClick={onClose} />
      <div className="tool-panel">
        <div className="tool-panel-header">
          <span className="tool-panel-title">🌐 翻译</span>
          <button className="tool-panel-close" onClick={onClose}>✕</button>
        </div>

        <div className="translate-lang">
          <span className="translate-lang-label">
            {direction === 'zh2en' ? '中 → 英' : '英 → 中'}
          </span>
          <button className="translate-lang-switch" onClick={toggleDirection}>
            ⇄ 切换
          </button>
          <span className="translate-lang-label" style={{ marginLeft: 'auto', fontSize: 10 }}>
            自动检测
          </span>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <input
            ref={inputRef}
            className="tool-panel-input"
            value={input}
            onChange={(e) => setInput(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            placeholder={direction === 'zh2en' ? '输入中文…' : '输入英文…'}
            style={{ flex: 1 }}
          />
          <button className="tool-panel-btn primary" onClick={handleTranslate} disabled={loading}>
            {loading ? '…' : '翻译'}
          </button>
        </div>

        <div className="tool-panel-body">
          {loading && (
            <div className="result-box loading">翻译中… ✨</div>
          )}
          {!loading && result && (
            <div className="result-box">{result}</div>
          )}
        </div>
      </div>
    </>
  )
}
