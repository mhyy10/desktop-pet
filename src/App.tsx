import { usePetStore } from './store/petStore'
import { usePetRenderer } from './hooks/usePetRenderer'
import { usePetInteraction } from './hooks/usePetInteraction'
import { useReminder } from './hooks/useReminder'
import { useChat } from './hooks/useChat'
import { ChatBubble } from './ui/ChatBubble'
import { QuickMenu } from './ui/QuickMenu'
import { NotePanel } from './ui/NotePanel'
import { ReminderPanel } from './ui/ReminderPanel'
import { SearchPanel } from './ui/SearchPanel'
import { TranslatePanel } from './ui/TranslatePanel'
import { WeatherPanel } from './ui/WeatherPanel'
import { SettingsPanel } from './ui/SettingsPanel'
import { MoodIndicator } from './ui/MoodIndicator'
import { ReminderNotification } from './ui/ReminderNotification'
import { LoadingIndicator } from './ui/LoadingIndicator'
import './App.css'

// ============================================
// 主应用 — 桌面宠物（像素风）
// 职责：组合 hooks + 渲染 UI，不含业务逻辑
// ============================================

export default function App() {
  const mood = usePetStore((s) => s.mood)
  const isChatOpen = usePetStore((s) => s.isChatOpen)
  const activePanel = usePetStore((s) => s.activePanel)
  const reminderNotif = usePetStore((s) => s.reminderNotif)
  const isReady = usePetStore((s) => s.isReady)
  const isDragging = usePetStore((s) => s.isDragging)
  const messages = usePetStore((s) => s.messages)
  const setActivePanel = usePetStore((s) => s.setActivePanel)
  const setChatOpen = usePetStore((s) => s.setChatOpen)

  // ---- 核心 hooks ----
  const {
    canvasRef, CANVAS_W, CANVAS_H,
    PET_CENTER_X, PET_CENTER_Y,
    reinitTheme, reinitRenderer, getStateMachine, getParticleSystem, getPhysics,
  } = usePetRenderer()

  const { canvasEventProps, containerEventProps } = usePetInteraction({
    canvasRef, PET_CENTER_X, PET_CENTER_Y,
    getStateMachine, getParticleSystem, getPhysics,
  })

  const { scheduleReminder, updateReminderConfig } = useReminder(
    getParticleSystem, getStateMachine, PET_CENTER_X, PET_CENTER_Y,
  )

  const {
    chatEngine, handleSendMessage, handleQuickAction, handleSettingsChange,
  } = useChat(reinitTheme, reinitRenderer, getParticleSystem, getStateMachine, PET_CENTER_X, PET_CENTER_Y)

  // ---- 渲染 ----
  return (
    <div
      className="pet-container"
      onContextMenu={(e) => e.preventDefault()}
      {...containerEventProps}
    >
      {/* 宠物 Canvas */}
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className={`pet-canvas ${isDragging ? 'dragging' : ''} pixel-canvas`}
        {...canvasEventProps}
      />

      {/* 加载指示 */}
      {!isReady && <LoadingIndicator />}

      {/* 心情指示器 */}
      <MoodIndicator mood={mood} />

      {/* 提醒通知 */}
      {reminderNotif && <ReminderNotification icon={reminderNotif.icon} text={reminderNotif.text} />}

      {/* 对话气泡 */}
      {isChatOpen && (
        <ChatBubble
          messages={messages}
          onSend={handleSendMessage}
          onClose={() => setChatOpen(false)}
        />
      )}

      {/* 侧边栏 */}
      <QuickMenu onAction={handleQuickAction} />

      {/* 工具面板 */}
      {activePanel === 'note' && <NotePanel onClose={() => setActivePanel(null)} />}
      {activePanel === 'remind' && <ReminderPanel onClose={() => setActivePanel(null)} onAdd={scheduleReminder} />}
      {activePanel === 'search' && <SearchPanel chatEngine={chatEngine} onClose={() => setActivePanel(null)} />}
      {activePanel === 'translate' && <TranslatePanel chatEngine={chatEngine} onClose={() => setActivePanel(null)} />}
      {activePanel === 'weather' && <WeatherPanel chatEngine={chatEngine} onClose={() => setActivePanel(null)} />}
      {activePanel === 'settings' && (
        <SettingsPanel
          chatEngine={chatEngine}
          onClose={() => setActivePanel(null)}
          onSettingsChange={(s) => {
            handleSettingsChange(s)
            updateReminderConfig({ enabled: s.reminderEnabled, intervalMinutes: s.reminderInterval })
          }}
        />
      )}
    </div>
  )
}
