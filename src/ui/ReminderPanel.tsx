import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import { loadReminders, addReminder, deleteReminder, type Reminder } from '../utils/storage'

interface ReminderPanelProps {
  onClose: () => void
  onAdd: (reminder: Reminder) => void
}

const PRESETS = [
  { label: '5分钟', minutes: 5 },
  { label: '15分钟', minutes: 15 },
  { label: '30分钟', minutes: 30 },
  { label: '1小时', minutes: 60 },
]

export function ReminderPanel({ onClose, onAdd }: ReminderPanelProps) {
  const [reminders, setReminders] = useState<Reminder[]>(() =>
    loadReminders().filter((r) => !r.fired)
  )
  const [input, setInput] = useState('')
  const [minutes, setMinutes] = useState(15)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleAdd = () => {
    const text = input.trim()
    if (!text) return
    const updated = addReminder(text, minutes)
    const newOne = updated[updated.length - 1]
    setReminders(updated.filter((r) => !r.fired))
    onAdd(newOne)
    setInput('')
    inputRef.current?.focus()
  }

  const handleDelete = (id: string) => {
    setReminders(deleteReminder(id).filter((r) => !r.fired))
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') handleAdd()
    if (e.key === 'Escape') onClose()
  }

  const pending = reminders.filter((r) => !r.fired).reverse()

  return (
    <>
      <div className="tool-panel-overlay" onClick={onClose} />
      <div className="tool-panel">
        <div className="tool-panel-header">
          <span className="tool-panel-title">⏰ 提醒</span>
          <button className="tool-panel-close" onClick={onClose}>✕</button>
        </div>

        <input
          ref={inputRef}
          className="tool-panel-input"
          value={input}
          onChange={(e) => setInput(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          placeholder="提醒我…"
        />

        <div className="reminder-presets">
          {PRESETS.map((p) => (
            <button
              key={p.minutes}
              className={`tool-panel-btn ${minutes === p.minutes ? 'primary' : ''}`}
              onClick={() => setMinutes(p.minutes)}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
          <button className="tool-panel-btn primary" onClick={handleAdd}>添加</button>
        </div>

        <div className="tool-panel-body">
          {pending.length === 0 && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 10 }}>
              暂无提醒
            </div>
          )}
          {pending.map((r) => (
            <div key={r.id} className="list-item">
              <span className="list-item-text">{r.text}</span>
              <span className="list-item-time">{fmtRemain(r.time)}</span>
              <button className="list-item-delete" onClick={() => handleDelete(r.id)}>✕</button>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

function fmtRemain(targetTs: number): string {
  const diff = targetTs - Date.now()
  if (diff <= 0) return '即将'
  const m = Math.floor(diff / 60_000)
  if (m < 60) return `${m}分钟后`
  return `${Math.floor(m / 60)}小时${m % 60}分钟后`
}
