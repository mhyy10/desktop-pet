import './QuickMenu.css'

interface QuickMenuProps {
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

export function QuickMenu({ onAction }: QuickMenuProps) {
  return (
    <>
      {/* 右边缘隐形触发热区 */}
      <div className="sidebar-trigger" />
      {/* 侧边栏面板 */}
      <nav className="pet-sidebar">
        {menuItems.map((item) => (
          <button
            key={item.id}
            className="sidebar-item"
            onClick={() => onAction(item.id)}
            title={item.label}
          >
            <span className="sidebar-icon">{item.icon}</span>
            <span className="sidebar-label">{item.label}</span>
          </button>
        ))}
      </nav>
    </>
  )
}
