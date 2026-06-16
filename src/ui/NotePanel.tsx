import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import { loadNotes, addNote, deleteNote, type Note } from '../utils/storage'

interface NotePanelProps {
  onClose: () => void
}

export function NotePanel({ onClose }: NotePanelProps) {
  const [notes, setNotes] = useState<Note[]>(loadNotes)
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSave = () => {
    const text = input.trim()
    if (!text) return
    setNotes(addNote(text))
    setInput('')
    inputRef.current?.focus()
  }

  const handleDelete = (id: string) => {
    setNotes(deleteNote(id))
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') onClose()
  }

  const recent = notes.slice(-5).reverse()

  return (
    <>
      <div className="tool-panel-overlay" onClick={onClose} />
      <div className="tool-panel">
        <div className="tool-panel-header">
          <span className="tool-panel-title">📝 笔记</span>
          <button className="tool-panel-close" onClick={onClose}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <input
            ref={inputRef}
            className="tool-panel-input"
            value={input}
            onChange={(e) => setInput(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            placeholder="写点什么…"
            style={{ flex: 1 }}
          />
          <button className="tool-panel-btn primary" onClick={handleSave}>保存</button>
        </div>

        <div className="tool-panel-body">
          {recent.length === 0 && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 16 }}>
              还没有笔记
            </div>
          )}
          {recent.map((n) => (
            <div key={n.id} className="list-item">
              <span className="list-item-text">{n.text}</span>
              <span className="list-item-time">{fmtTime(n.time)}</span>
              <button className="list-item-delete" onClick={() => handleDelete(n.id)}>✕</button>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

function fmtTime(ts: number): string {
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}
