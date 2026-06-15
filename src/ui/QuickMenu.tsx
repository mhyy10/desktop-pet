import './QuickMenu.css'

interface QuickMenuProps {
  x: number
  y: number
  onAction: (action: string) => void
  onClose: () => void
}

const menuItems = [
  { id: 'note', icon: '📝', label: '快速笔记' },
  { id: 'remind', icon: '⏰', label: '设置提醒' },
  { id: 'search', icon: '🔍', label: '搜索' },
  { id: 'translate', icon: '🌐', label: '翻译' },
  { id: 'weather', icon: '🌤', label: '天气' },
  { id: 'settings', icon: '⚙️', label: '设置' },
]

export function QuickMenu({ x, y, onAction, onClose }: QuickMenuProps) {
  return (
    <>
      <div className="quick-menu-overlay" onClick={onClose} />
      <div className="quick-menu" style={{ left: x, top: y }}>
        {menuItems.map((item) => (
          <button
            key={item.id}
            className="quick-menu-item"
            onClick={() => {
              onAction(item.id)
              onClose()
            }}
          >
            <span className="item-icon">{item.icon}</span>
            <span className="item-label">{item.label}</span>
          </button>
        ))}
      </div>
    </>
  )
}
