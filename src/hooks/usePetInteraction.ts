import { useRef, useCallback } from 'react'
import { usePetStore } from '../store/petStore'
import { audioManager, type StateMachine, type ParticleSystem, type SpringPhysics2D } from '../pet'

// ============================================
// 宠物交互 Hook — 拖拽(惯性) + 点击 + 双击 + 长按 + 音效
// ============================================

const isTauri = !!window.__TAURI_INTERNALS__

// Tauri API — 仅在 Tauri 环境中可用
let tauriWindow: typeof import('@tauri-apps/api/window') | null = null
try {
  if (window.__TAURI_INTERNALS__) {
    import('@tauri-apps/api/window').then((m) => { tauriWindow = m })
  }
} catch {
  // 浏览器环境，忽略
}

/** 速度采样窗口大小 */
const VELOCITY_SAMPLES = 5

/** 双击间隔阈值（ms） */
const DOUBLE_CLICK_THRESHOLD = 300

/** 长按阈值（ms） */
const LONG_PRESS_THRESHOLD = 500

/** 长按移动容差（px） */
const LONG_PRESS_MOVE_TOLERANCE = 5

interface UsePetInteractionOptions {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  PET_CENTER_X: number
  PET_CENTER_Y: number
  getStateMachine: () => StateMachine
  getParticleSystem: () => ParticleSystem
  getPhysics: () => SpringPhysics2D
}

export function usePetInteraction({
  PET_CENTER_X,
  PET_CENTER_Y,
  getStateMachine,
  getParticleSystem,
  getPhysics,
}: UsePetInteractionOptions) {
  const isDragTrackingRef = useRef(false)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const hasMovedRef = useRef(false)

  // 速度采样（用于计算惯性抛出速度）
  const velocitySamplesRef = useRef<Array<{ x: number; y: number; t: number }>>([])

  // 双击检测
  const lastClickTimeRef = useRef(0)

  // 长按检测
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressFiredRef = useRef(false)
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null)

  const store = usePetStore

  // ---- 清理长按定时器 ----
  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [])

  // ---- 长按触发 ----
  const handleLongPress = useCallback(() => {
    longPressFiredRef.current = true
    const s = store.getState()
    s.updateInteraction()
    getStateMachine().setMood('shy')
    getParticleSystem().emit('sparkle', PET_CENTER_X, PET_CENTER_Y - 20, 5, { size: 0.6 })
    audioManager.play('long_press')

    // 弹出长按气泡
    s.addMessage({
      id: crypto.randomUUID(),
      role: 'pet',
      content: '别戳我啦… 🥺',
      timestamp: Date.now(),
    })
  }, [PET_CENTER_X, PET_CENTER_Y, store, getStateMachine, getParticleSystem])

  // ---- 点击宠物（含双击检测） ----
  const handlePetClick = useCallback(() => {
    if (hasMovedRef.current || longPressFiredRef.current) return

    const now = Date.now()
    const timeSinceLastClick = now - lastClickTimeRef.current
    lastClickTimeRef.current = now

    const s = store.getState()
    s.updateInteraction()

    // 初始化 AudioContext（需要用户交互触发）
    audioManager.init()

    if (timeSinceLastClick < DOUBLE_CLICK_THRESHOLD) {
      // ---- 双击 ----
      lastClickTimeRef.current = 0 // 重置，防止三击
      getStateMachine().setMood('excited')
      getParticleSystem().emit('heart', PET_CENTER_X, PET_CENTER_Y - 20, 8)
      audioManager.play('double_click')
      s.setAction('play')
    } else {
      // ---- 单击 ----
      getStateMachine().setMood('happy')
      getParticleSystem().emit('sparkle', PET_CENTER_X, PET_CENTER_Y - 20, 6)
      audioManager.play('click')
      s.setChatOpen(true)
    }
  }, [PET_CENTER_X, PET_CENTER_Y, store, getStateMachine, getParticleSystem])

  // ---- 拖拽 ----
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    isDragTrackingRef.current = true
    hasMovedRef.current = false
    longPressFiredRef.current = false
    dragStartRef.current = { x: e.clientX, y: e.clientY }
    mouseDownPosRef.current = { x: e.clientX, y: e.clientY }
    velocitySamplesRef.current = [{ x: e.clientX, y: e.clientY, t: Date.now() }]

    // 停止之前的惯性
    getPhysics().stopFling()

    // 启动长按检测
    clearLongPressTimer()
    longPressTimerRef.current = setTimeout(() => {
      // 检查是否没移动过
      if (!hasMovedRef.current) {
        handleLongPress()
      }
    }, LONG_PRESS_THRESHOLD)

    if (isTauri && tauriWindow) {
      tauriWindow.getCurrentWindow().startDragging().catch(() => {})
      store.getState().setDragging(true)
    }
  }, [store, getPhysics, clearLongPressTimer, handleLongPress])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    // 检测是否超出长按移动容差
    if (mouseDownPosRef.current && !hasMovedRef.current) {
      const dx = Math.abs(e.clientX - mouseDownPosRef.current.x)
      const dy = Math.abs(e.clientY - mouseDownPosRef.current.y)
      if (dx > LONG_PRESS_MOVE_TOLERANCE || dy > LONG_PRESS_MOVE_TOLERANCE) {
        clearLongPressTimer()
      }
    }

    if (!isDragTrackingRef.current || isTauri) return

    const dx = e.clientX - (dragStartRef.current?.x ?? 0)
    const dy = e.clientY - (dragStartRef.current?.y ?? 0)

    // 记录速度采样
    velocitySamplesRef.current.push({ x: e.clientX, y: e.clientY, t: Date.now() })
    if (velocitySamplesRef.current.length > VELOCITY_SAMPLES) {
      velocitySamplesRef.current.shift()
    }

    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      const s = store.getState()
      if (!s.isDragging) {
        s.setDragging(true)
        audioManager.play('drag')
      }
      hasMovedRef.current = true
      clearLongPressTimer()
      getPhysics().stretch(PET_CENTER_X + dx, PET_CENTER_Y + dy)
    }
  }, [PET_CENTER_X, PET_CENTER_Y, store, getPhysics, clearLongPressTimer])

  const handleMouseUp = useCallback(() => {
    clearLongPressTimer()

    const s = store.getState()
    if (s.isDragging) {
      if (!isTauri) {
        // 计算惯性抛出速度
        const vx = computeFlingVelocity(velocitySamplesRef.current, 'x')
        const vy = computeFlingVelocity(velocitySamplesRef.current, 'y')

        // 如果有足够的速度就惯性抛出，否则回弹
        if (Math.abs(vx) > 1 || Math.abs(vy) > 1) {
          getPhysics().fling(vx * 1.5, vy * 1.5)
          audioManager.play('bounce')
        } else {
          getPhysics().setTarget(PET_CENTER_X, PET_CENTER_Y)
        }
      }
      getParticleSystem().emit('star', PET_CENTER_X, PET_CENTER_Y, 4)
      s.setDragging(false)
    }
    isDragTrackingRef.current = false
    dragStartRef.current = null
    mouseDownPosRef.current = null
    velocitySamplesRef.current = []
  }, [PET_CENTER_X, PET_CENTER_Y, store, getPhysics, getParticleSystem, clearLongPressTimer])

  // ---- 绑定到 canvas 的事件 props ----
  const canvasEventProps = {
    onMouseDown: handleMouseDown,
    onClick: handlePetClick,
  }

  // ---- 容器级事件 props ----
  const containerEventProps = {
    onMouseMove: handleMouseMove,
    onMouseUp: handleMouseUp,
    onMouseLeave: handleMouseUp,
  }

  return { canvasEventProps, containerEventProps }
}

// ---- 工具函数 ----

/** 根据速度采样计算抛出速度（像素/帧） */
function computeFlingVelocity(
  samples: Array<{ x: number; y: number; t: number }>,
  axis: 'x' | 'y',
): number {
  if (samples.length < 2) return 0

  // 取最近的几个采样点计算平均速度
  const recent = samples.slice(-3)
  const first = recent[0]
  const last = recent[recent.length - 1]
  const dt = last.t - first.t

  if (dt === 0) return 0

  const dx = (last[axis] - first[axis]) / (dt / 16.67) // 归一化到每帧（~16.67ms）

  // 限制最大速度，防止飞出屏幕
  return Math.max(-20, Math.min(20, dx))
}
