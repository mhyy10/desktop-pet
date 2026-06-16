import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import { ChatEngine } from '../ai'

interface SearchPanelProps {
  chatEngine: ChatEngine
  onClose: () => void
}

export function SearchPanel({ chatEngine, onClose }: SearchPanelProps) {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSearch = async () => {
    const q = query.trim()
    if (!q || loading) return
    setLoading(true)
    setResult('')
    try {
      const answer = await chatEngine.search(q)
      setResult(answer)
    } catch {
      setResult('搜索出错了，稍后再试 🥺')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
    if (e.key === 'Escape') onClose()
  }

  return (
    <>
      <div className="tool-panel-overlay" onClick={onClose} />
      <div className="tool-panel">
        <div className="tool-panel-header">
          <span className="tool-panel-title">🔍 搜索</span>
          <button className="tool-panel-close" onClick={onClose}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <input
            ref={inputRef}
            className="tool-panel-input"
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            placeholder="想搜点什么？"
            style={{ flex: 1 }}
          />
          <button className="tool-panel-btn primary" onClick={handleSearch} disabled={loading}>
            {loading ? '…' : '搜索'}
          </button>
        </div>

        <div className="tool-panel-body">
          {loading && (
            <div className="result-box loading">正在搜索… ✨</div>
          )}
          {!loading && result && (
            <div className="result-box">{result}</div>
          )}
        </div>
      </div>
    </>
  )
}
