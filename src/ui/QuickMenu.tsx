import { useEffect } from 'react'
import './QuickMenu.css'

interface QuickMenuProps {
  isOpen: boolean
  onClose: () => void
  onAction: (action: string) => void
}

const menuItems = [
  { id: 'note', icon: '📝', label: '笔记' },
  { id: 'remind', icon: '⏰', label: '提醒' },
  { id: 'search', icon: '🔍', label: '搜索' },
  { id: 'translate', icon: '🌐', label: '翻译' },
  { id: 'weather', icon: '🌤', label: '天气' },
  { id: 'settings', icon: '⚙️', label: '设置' },
]

export function QuickMenu({ isOpen, onClose, onAction }: QuickMenuProps) {
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <nav className="quick-panel" aria-label="快捷工具">
      <button
        className="quick-panel-close"
        onClick={onClose}
        aria-label="关闭快捷工具"
      >
        ✕
      </button>
      <div className="quick-panel-grid">
        {menuItems.map((item) => (
          <button
            key={item.id}
            className="quick-panel-item"
            onClick={() => {
              onAction(item.id)
              onClose()
            }}
            title={item.label}
          >
            <span className="quick-panel-icon">{item.icon}</span>
            <span className="quick-panel-label">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}
