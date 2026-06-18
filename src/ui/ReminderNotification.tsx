// ============================================
// 提醒通知条 — 顶部弹出
// ============================================

interface ReminderNotificationProps {
  icon: string
  text: string
}

export function ReminderNotification({ icon, text }: ReminderNotificationProps) {
  return (
    <div className="reminder-notification">
      {icon} {text}
    </div>
  )
}
