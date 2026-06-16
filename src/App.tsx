import { useState, useRef, useEffect, useCallback } from 'react'
import {
  StateMachine,
  BehaviorTree,
  PixelRenderer,
  ParticleSystem,
  SpringPhysics2D,
  ReminderScheduler,
  defaultTheme,
  type PetMood,
  type PetState,
  type ChatMessage,
  type ProactiveReminder,
} from './pet'
import { ChatEngine } from './ai'
import { ChatBubble } from './ui/ChatBubble'
import { QuickMenu } from './ui/QuickMenu'
import { NotePanel } from './ui/NotePanel'
import { ReminderPanel } from './ui/ReminderPanel'
import { SearchPanel } from './ui/SearchPanel'
import { TranslatePanel } from './ui/TranslatePanel'
import { WeatherPanel } from './ui/WeatherPanel'
import { SettingsPanel } from './ui/SettingsPanel'
import { type Reminder, markReminderFired, loadReminders, loadSettings, type PetSettings } from './utils/storage'
import './App.css'

// Tauri API — 仅在 Tauri 环境中可用
let tauriWindow: typeof import('@tauri-apps/api/window') | null = null
let tauriEvent: typeof import('@tauri-apps/api/event') | null = null
try {
  if (window.__TAURI_INTERNALS__) {
    tauriWindow = await import('@tauri-apps/api/window')
    tauriEvent = await import('@tauri-apps/api/event')
  }
} catch {
  // 浏览器环境，忽略
}

// ============================================
// 主应用 — 桌面宠物（像素风）
// ============================================

const CANVAS_W = 300
const CANVAS_H = 350
const PET_CENTER_X = CANVAS_W / 2
const PET_CENTER_Y = CANVAS_H / 2 + 20

const isTauri = !!window.__TAURI_INTERNALS__

type PanelType = 'note' | 'remind' | 'search' | 'translate' | 'weather' | 'settings' | null

export default function App() {
  // ---- 核心系统 ----
  const stateMachineRef = useRef(new StateMachine())
  const behaviorTreeRef = useRef(new BehaviorTree())
  const chatEngineRef = useRef(new ChatEngine())
  const reminderSchedulerRef = useRef(new ReminderScheduler())
  const particleSystemRef = useRef(new ParticleSystem())
  const physicsRef = useRef(new SpringPhysics2D(PET_CENTER_X, PET_CENTER_Y))
  const pixelRendererRef = useRef<PixelRenderer | null>(null)

  // ---- 响应式状态 ----
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animFrameRef = useRef(0)
  const lastTimeRef = useRef(performance.now())

  const [mood, setMood] = useState<PetMood>('happy')
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [, setCurrentModel] = useState<string>('zhanlu/glm-5.1')
  const [activePanel, setActivePanel] = useState<PanelType>(null)
  const [reminderNotif, setReminderNotif] = useState<{ icon: string; text: string } | null>(null)

  // 拖拽 & 提醒定时器
  const isDragTrackingRef = useRef(false)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const hasMovedRef = useRef(false)
  const reminderTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // ---- 宠物状态 ----
  const petStateRef = useRef<PetState>({
    mood: 'happy',
    action: 'idle_stand',
    position: { x: PET_CENTER_X, y: PET_CENTER_Y },
    scale: 1.0,
    lastInteractionTime: Date.now(),
    isDragging: false,
    isChatOpen: false,
  })

  // ---- 从 storage 加载设置并初始化 ChatEngine ----
  useEffect(() => {
    const saved = loadSettings()
    chatEngineRef.current.updateConfig({
      apiKey: saved.apiKey || undefined,
      baseUrl: saved.baseUrl,
      model: saved.model,
    })
    setCurrentModel(saved.model)

    // 初始化主动提醒调度器
    const scheduler = reminderSchedulerRef.current
    scheduler.updateConfig({
      enabled: saved.reminderEnabled,
      intervalMinutes: saved.reminderInterval,
    })
    scheduler.onFire((r: ProactiveReminder) => {
      setReminderNotif({ icon: r.icon, text: r.text })
      particleSystemRef.current.emit('sparkle', PET_CENTER_X, PET_CENTER_Y - 30, 6)
      stateMachineRef.current.setMood('excited')
      setTimeout(() => setReminderNotif(null), 5000)
    })
    scheduler.start()

    return () => { scheduler.stop() }
  }, [])

  // ---- 监听托盘事件（打开设置） ----
  useEffect(() => {
    if (!isTauri || !tauriEvent) return
    let unlisten: (() => void) | null = null

    tauriEvent.listen('tray-open-settings', () => {
      setActivePanel('settings')
    }).then((fn) => { unlisten = fn })

    return () => { unlisten?.() }
  }, [])

  // ---- 初始化 ----
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')!
    const renderer = new PixelRenderer(ctx, defaultTheme)

    renderer.init().then(() => {
      pixelRendererRef.current = renderer
      setIsReady(true)

      const greeting = stateMachineRef.current.getRandomGreeting()
      setMessages([{
        id: crypto.randomUUID(),
        role: 'pet',
        content: greeting,
        timestamp: Date.now(),
      }])
    })
  }, [])

  // ---- 恢复未触发的提醒定时器 ----
  useEffect(() => {
    const pending = loadReminders().filter((r) => !r.fired && r.time > Date.now())
    pending.forEach((r) => scheduleReminder(r))
  }, [])

  // ---- 状态机回调 ----
  useEffect(() => {
    const unsub = stateMachineRef.current.onChange((newMood, _newAction) => {
      setMood(newMood)
      petStateRef.current.mood = newMood
      petStateRef.current.action = _newAction
    })
    return () => unsub()
  }, [])

  // ---- 同步 isChatOpen ----
  useEffect(() => {
    petStateRef.current.isChatOpen = isChatOpen
  }, [isChatOpen])

  // ---- 主渲染循环 ----
  useEffect(() => {
    if (!isReady) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')!
    const renderer = pixelRendererRef.current!
    const particles = particleSystemRef.current
    const physics = physicsRef.current
    const sm = stateMachineRef.current
    const bt = behaviorTreeRef.current

    const loop = (now: number) => {
      const delta = now - lastTimeRef.current
      lastTimeRef.current = now

      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)

      const pos = physics.update()
      const currentAction = bt.tick(petStateRef.current, delta)
      petStateRef.current.action = currentAction

      if (Math.floor(now / 1000) !== Math.floor((now - delta) / 1000)) {
        sm.tick(petStateRef.current)
      }

      renderer.tick(delta)
      renderer.draw(sm.mood, petStateRef.current.action, pos.x, pos.y, now, petStateRef.current.scale)
      particles.update(delta)
      particles.draw(ctx)

      animFrameRef.current = requestAnimationFrame(loop)
    }

    animFrameRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [isReady])

  // ---- 提醒调度 ----
  const scheduleReminder = useCallback((r: Reminder) => {
    const delay = r.time - Date.now()
    if (delay <= 0) return

    const timer = setTimeout(() => {
      setReminderNotif({ icon: '⏰', text: r.text })
      particleSystemRef.current.emit('sparkle', PET_CENTER_X, PET_CENTER_Y - 30, 8)
      stateMachineRef.current.setMood('excited')
      markReminderFired(r.id)
      reminderTimersRef.current.delete(r.id)

      // 5 秒后自动关闭通知
      setTimeout(() => setReminderNotif(null), 5000)
    }, delay)

    reminderTimersRef.current.set(r.id, timer)
  }, [])

  // ---- 点击宠物 ----
  const handlePetClick = useCallback(() => {
    if (hasMovedRef.current) return
    petStateRef.current.lastInteractionTime = Date.now()
    stateMachineRef.current.setMood('happy')
    particleSystemRef.current.emit('sparkle', PET_CENTER_X, PET_CENTER_Y - 20, 6)
    setIsChatOpen(true)
  }, [])

  // ---- 拖拽 ----
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    isDragTrackingRef.current = true
    hasMovedRef.current = false
    dragStartRef.current = { x: e.clientX, y: e.clientY }

    if (isTauri && tauriWindow) {
      tauriWindow.getCurrentWindow().startDragging().catch(() => {})
      setIsDragging(true)
      petStateRef.current.isDragging = true
    }
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragTrackingRef.current || isTauri) return

    const dx = e.clientX - (dragStartRef.current?.x ?? 0)
    const dy = e.clientY - (dragStartRef.current?.y ?? 0)

    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      if (!isDragging) {
        setIsDragging(true)
        petStateRef.current.isDragging = true
      }
      hasMovedRef.current = true
      physicsRef.current.stretch(PET_CENTER_X + dx, PET_CENTER_Y + dy)
    }
  }, [isDragging])

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      if (!isTauri) {
        physicsRef.current.setTarget(PET_CENTER_X, PET_CENTER_Y)
      }
      particleSystemRef.current.emit('star', PET_CENTER_X, PET_CENTER_Y, 4)
      setIsDragging(false)
      petStateRef.current.isDragging = false
    }
    isDragTrackingRef.current = false
    dragStartRef.current = null
  }, [isDragging])

  // ---- 发送消息 ----
  const handleSendMessage = useCallback(async (text: string) => {
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    }
    setMessages((prev) => [...prev, userMsg])
    petStateRef.current.lastInteractionTime = Date.now()

    stateMachineRef.current.setMood('thinking')
    particleSystemRef.current.emit('sparkle', PET_CENTER_X, PET_CENTER_Y - 30, 3, { size: 0.6 })

    try {
      const reply = await chatEngineRef.current.chat(text)
      const petMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'pet',
        content: reply,
        timestamp: Date.now(),
      }
      setMessages((prev) => [...prev, petMsg])
      stateMachineRef.current.setMood('happy')
      particleSystemRef.current.emit('heart', PET_CENTER_X, PET_CENTER_Y - 20, 3)
    } catch {
      stateMachineRef.current.setMood('bored')
    }
  }, [])

  // ---- 侧边栏动作 ----
  const handleQuickAction = useCallback((actionId: string) => {
    // 切换面板（再点关闭）
    if (['note', 'remind', 'search', 'translate', 'weather', 'settings'].includes(actionId)) {
      setActivePanel((prev) => prev === actionId ? null : (actionId as PanelType))
      return
    }
  }, [handleSendMessage])

  // ---- 设置变更回调 ----
  const handleSettingsChange = useCallback((settings: PetSettings) => {
    setCurrentModel(settings.model)
    // 同步提醒调度器设置
    reminderSchedulerRef.current.updateConfig({
      enabled: settings.reminderEnabled,
      intervalMinutes: settings.reminderInterval,
    })
  }, [])

  // ---- 打盹粒子 ----
  useEffect(() => {
    const interval = setInterval(() => {
      if (stateMachineRef.current.mood === 'sleeping') {
        particleSystemRef.current.emit('zzz', PET_CENTER_X, PET_CENTER_Y - 50, 1, { speed: 0.5, size: 0.8 })
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  // ---- 渲染 ----
  return (
    <div
      className="pet-container"
      onContextMenu={(e) => e.preventDefault()}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* 宠物 Canvas */}
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className={`pet-canvas ${isDragging ? 'dragging' : ''} pixel-canvas`}
        onMouseDown={handleMouseDown}
        onClick={handlePetClick}
      />

      {/* 加载指示 */}
      {!isReady && (
        <div className="loading-indicator">
          <span className="loading-dot" />
          <span className="loading-text">生成中…</span>
        </div>
      )}

      {/* 心情指示器 */}
      <div className="mood-indicator">
        <span className="mood-dot" style={{ background: moodColor(mood) }} />
        <span className="mood-text">{moodLabel(mood)}</span>
      </div>

      {/* 提醒通知 */}
      {reminderNotif && (
        <div className="reminder-notification">
          {reminderNotif.icon} {reminderNotif.text}
        </div>
      )}

      {/* 对话气泡 */}
      {isChatOpen && (
        <ChatBubble
          messages={messages}
          onSend={handleSendMessage}
          onClose={() => setIsChatOpen(false)}
        />
      )}

      {/* 侧边栏 */}
      <QuickMenu onAction={handleQuickAction} />

      {/* 工具面板 */}
      {activePanel === 'note' && <NotePanel onClose={() => setActivePanel(null)} />}
      {activePanel === 'remind' && <ReminderPanel onClose={() => setActivePanel(null)} onAdd={scheduleReminder} />}
      {activePanel === 'search' && <SearchPanel chatEngine={chatEngineRef.current} onClose={() => setActivePanel(null)} />}
      {activePanel === 'translate' && <TranslatePanel chatEngine={chatEngineRef.current} onClose={() => setActivePanel(null)} />}
      {activePanel === 'weather' && <WeatherPanel chatEngine={chatEngineRef.current} onClose={() => setActivePanel(null)} />}
      {activePanel === 'settings' && (
        <SettingsPanel
          chatEngine={chatEngineRef.current}
          onClose={() => setActivePanel(null)}
          onSettingsChange={handleSettingsChange}
        />
      )}
    </div>
  )
}

// ---- 工具函数 ----

function moodColor(mood: PetMood): string {
  const colors: Record<PetMood, string> = {
    happy: '#FDCB6E', idle: '#74B9FF', bored: '#A29BFE', sleeping: '#636E72',
    excited: '#00B894', shy: '#FD79A8', angry: '#E17055', thinking: '#0984E3',
    surprised: '#FFEAA7',
  }
  return colors[mood]
}

function moodLabel(mood: PetMood): string {
  const labels: Record<PetMood, string> = {
    happy: '开心', idle: '平静', bored: '无聊', sleeping: '打盹',
    excited: '兴奋', shy: '害羞', angry: '生气', thinking: '思考',
    surprised: '惊讶',
  }
  return labels[mood]
}
