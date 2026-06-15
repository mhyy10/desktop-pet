import { useState, useRef, useEffect, useCallback } from 'react'
import {
  StateMachine,
  BehaviorTree,
  PixelRenderer,
  ParticleSystem,
  SpringPhysics2D,
  defaultTheme,
  type PetMood,
  type PetState,
  type ChatMessage,
} from './pet'
import { ChatEngine } from './ai'
import { ChatBubble } from './ui/ChatBubble'
import { QuickMenu } from './ui/QuickMenu'
import './App.css'

// Tauri API — 仅在 Tauri 环境中可用
let tauriWindow: typeof import('@tauri-apps/api/window') | null = null
try {
  // 动态检测是否在 Tauri 环境中
  if (window.__TAURI_INTERNALS__) {
    tauriWindow = await import('@tauri-apps/api/window')
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

/** 是否运行在 Tauri 桌面环境中 */
const isTauri = !!window.__TAURI_INTERNALS__

export default function App() {
  // ---- 核心系统（只用 useRef 存，避免重渲染） ----
  const stateMachineRef = useRef(new StateMachine())
  const behaviorTreeRef = useRef(new BehaviorTree())
  const chatEngineRef = useRef(new ChatEngine())
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
  const [quickMenu, setQuickMenu] = useState<{ x: number; y: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isReady, setIsReady] = useState(false)

  // 拖拽状态
  const isDragTrackingRef = useRef(false)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const hasMovedRef = useRef(false)

  // ---- 宠物状态（非响应式，每帧读取） ----
  const petStateRef = useRef<PetState>({
    mood: 'happy',
    action: 'idle_stand',
    position: { x: PET_CENTER_X, y: PET_CENTER_Y },
    scale: 1.0,
    lastInteractionTime: Date.now(),
    isDragging: false,
    isChatOpen: false,
  })

  // ---- 初始化：生成精灵图 ----
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')!
    const renderer = new PixelRenderer(ctx, defaultTheme)

    renderer.init().then(() => {
      pixelRendererRef.current = renderer
      setIsReady(true)

      // 欢迎消息
      const greeting = stateMachineRef.current.getRandomGreeting()
      setMessages([
        {
          id: crypto.randomUUID(),
          role: 'pet',
          content: greeting,
          timestamp: Date.now(),
        },
      ])
    })
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

  // ---- 同步 isChatOpen 到 ref ----
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

      // 清空画布（透明背景）
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)

      // 更新物理
      const pos = physics.update()

      // 更新行为树
      const currentAction = bt.tick(petStateRef.current, delta)
      petStateRef.current.action = currentAction

      // 更新状态机（每秒检查一次）
      if (Math.floor(now / 1000) !== Math.floor((now - delta) / 1000)) {
        sm.tick(petStateRef.current)
      }

      // 更新动画控制器
      renderer.tick(delta)

      // 绘制宠物（像素风）
      renderer.draw(
        sm.mood,
        petStateRef.current.action,
        pos.x,
        pos.y,
        now,
        petStateRef.current.scale
      )

      // 更新和绘制粒子
      particles.update(delta)
      particles.draw(ctx)

      animFrameRef.current = requestAnimationFrame(loop)
    }

    animFrameRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [isReady])

  // ---- 交互：点击宠物 ----
  const handlePetClick = useCallback(() => {
    if (hasMovedRef.current) return // 拖拽过就不触发点击

    petStateRef.current.lastInteractionTime = Date.now()

    // 开心 + 星星粒子
    stateMachineRef.current.setMood('happy')
    particleSystemRef.current.emit('sparkle', PET_CENTER_X, PET_CENTER_Y - 20, 6)

    // 打开对话
    setIsChatOpen(true)
  }, [])

  // ---- 交互：右键菜单 ----
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setQuickMenu({ x: e.clientX, y: e.clientY })
  }, [])

  // ---- 交互：拖拽（Tauri 桌面环境 → 拖动窗口 / 浏览器 → Canvas 内拖动） ----
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return // 只响应左键

    isDragTrackingRef.current = true
    hasMovedRef.current = false
    dragStartRef.current = { x: e.clientX, y: e.clientY }

    // Tauri 环境：立即调用 startDragging 让操作系统接管拖拽
    if (isTauri && tauriWindow) {
      tauriWindow.getCurrentWindow().startDragging().catch(() => {
        // startDragging 失败则回退到手动拖拽
      })
      setIsDragging(true)
      petStateRef.current.isDragging = true
    }
  }, [])

  // 浏览器环境的 fallback 拖拽（Tauri 用 startDragging 不需要这些）
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

      const newX = PET_CENTER_X + dx
      const newY = PET_CENTER_Y + dy
      physicsRef.current.stretch(newX, newY)
    }
  }, [isDragging])

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      if (!isTauri) {
        // 浏览器环境：弹回中心
        physicsRef.current.setTarget(PET_CENTER_X, PET_CENTER_Y)
      }
      particleSystemRef.current.emit('star', PET_CENTER_X, PET_CENTER_Y, 4)
      setIsDragging(false)
      petStateRef.current.isDragging = false
    }
    isDragTrackingRef.current = false
    dragStartRef.current = null
  }, [isDragging])

  // ---- 交互：发送消息 ----
  const handleSendMessage = useCallback(async (text: string) => {
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    }
    setMessages((prev) => [...prev, userMsg])
    petStateRef.current.lastInteractionTime = Date.now()

    // 思考状态
    stateMachineRef.current.setMood('thinking')
    particleSystemRef.current.emit('sparkle', PET_CENTER_X, PET_CENTER_Y - 30, 3, {
      size: 0.6,
    })

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

  // ---- 交互：快捷菜单 ----
  const handleQuickAction = useCallback((actionId: string) => {
    switch (actionId) {
      case 'note':
        handleSendMessage('帮我记一条笔记')
        setIsChatOpen(true)
        break
      case 'remind':
        handleSendMessage('帮我设一个提醒')
        setIsChatOpen(true)
        break
      case 'search':
        handleSendMessage('帮我搜索一下')
        setIsChatOpen(true)
        break
      case 'translate':
        handleSendMessage('帮我翻译')
        setIsChatOpen(true)
        break
      case 'weather':
        handleSendMessage('今天天气怎么样？')
        setIsChatOpen(true)
        break
      default:
        break
    }
  }, [handleSendMessage])

  // ---- 周期性粒子效果（打盹时 zzZ） ----
  useEffect(() => {
    const interval = setInterval(() => {
      if (stateMachineRef.current.mood === 'sleeping') {
        particleSystemRef.current.emit('zzz', PET_CENTER_X, PET_CENTER_Y - 50, 1, {
          speed: 0.5,
          size: 0.8,
        })
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  // ---- 渲染 ----
  return (
    <div
      className="pet-container"
      onContextMenu={handleContextMenu}
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

      {/* 对话气泡 */}
      {isChatOpen && (
        <ChatBubble
          messages={messages}
          onSend={handleSendMessage}
          onClose={() => setIsChatOpen(false)}
        />
      )}

      {/* 右键菜单 */}
      {quickMenu && (
        <QuickMenu
          x={quickMenu.x}
          y={quickMenu.y}
          onAction={handleQuickAction}
          onClose={() => setQuickMenu(null)}
        />
      )}
    </div>
  )
}

// ---- 工具函数 ----

function moodColor(mood: PetMood): string {
  const colors: Record<PetMood, string> = {
    happy: '#FDCB6E',
    idle: '#74B9FF',
    bored: '#A29BFE',
    sleeping: '#636E72',
    excited: '#00B894',
    shy: '#FD79A8',
    angry: '#E17055',
    thinking: '#0984E3',
    surprised: '#FFEAA7',
  }
  return colors[mood]
}

function moodLabel(mood: PetMood): string {
  const labels: Record<PetMood, string> = {
    happy: '开心',
    idle: '平静',
    bored: '无聊',
    sleeping: '打盹',
    excited: '兴奋',
    shy: '害羞',
    angry: '生气',
    thinking: '思考',
    surprised: '惊讶',
  }
  return labels[mood]
}
