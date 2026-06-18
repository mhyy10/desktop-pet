import { useRef, useCallback } from 'react'
import { usePetStore } from '../store/petStore'
import { audioManager, type StateMachine, type ParticleSystem, type SpringPhysics2D } from '../pet'

// ============================================
// 宠物交互 Hook — 拖拽(惯性) + 点击 + 双击 + 长按 + 音效
//
// 关键设计：
// - mousedown 只记录起点，不立即拖拽
// - mousemove 超过 DRAG_THRESHOLD 才开始拖拽（Tauri 调 startDragging）
// - 这样 click/dblclick 事件不会被吞掉
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
const DOUBLE_CLICK_THRESHOLD = 350

/** 长按阈值（ms） */
const LONG_PRESS_THRESHOLD = 500

/** 长按移动容差（px） */
const LONG_PRESS_MOVE_TOLERANCE = 5

/** 拖拽触发阈值（px）— 移动超过此距离才算拖拽 */
const DRAG_THRESHOLD = 5

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
  /** 是否已经真正进入拖拽模式（超过阈值） */
  const isDraggingActiveRef = useRef(false)

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

    s.addMessage({
      id: crypto.randomUUID(),
      role: 'pet',
      content: '别戳我啦… 🥺',
      timestamp: Date.now(),
    })
  }, [PET_CENTER_X, PET_CENTER_Y, store, getStateMachine, getParticleSystem])

  // ---- 点击宠物（含双击检测） ----
  const handlePetClick = useCallback(() => {
    // 只有没移动过且没触发长按，才算有效点击
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

  // ---- mousedown：只记录起点，不立即拖拽 ----
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return

    isDragTrackingRef.current = true
    hasMovedRef.current = false
    isDraggingActiveRef.current = false
    longPressFiredRef.current = false
    dragStartRef.current = { x: e.clientX, y: e.clientY }
    mouseDownPosRef.current = { x: e.clientX, y: e.clientY }
    velocitySamplesRef.current = [{ x: e.clientX, y: e.clientY, t: Date.now() }]

    // 停止之前的惯性
    getPhysics().stopFling()

    // 启动长按检测
    clearLongPressTimer()
    longPressTimerRef.current = setTimeout(() => {
      if (!hasMovedRef.current) {
        handleLongPress()
      }
    }, LONG_PRESS_THRESHOLD)
  }, [getPhysics, clearLongPressTimer, handleLongPress])

  // ---- mousemove：超过阈值才真正开始拖拽 ----
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragTrackingRef.current) return

    const dx = e.clientX - (dragStartRef.current?.x ?? 0)
    const dy = e.clientY - (dragStartRef.current?.y ?? 0)
    const moveDistance = Math.sqrt(dx * dx + dy * dy)

    // 检测是否超出长按移动容差
    if (mouseDownPosRef.current && !hasMovedRef.current) {
      const ldx = Math.abs(e.clientX - mouseDownPosRef.current.x)
      const ldy = Math.abs(e.clientY - mouseDownPosRef.current.y)
      if (ldx > LONG_PRESS_MOVE_TOLERANCE || ldy > LONG_PRESS_MOVE_TOLERANCE) {
        clearLongPressTimer()
      }
    }

    // 超过拖拽阈值 → 进入拖拽模式
    if (moveDistance > DRAG_THRESHOLD && !isDraggingActiveRef.current) {
      isDraggingActiveRef.current = true
      hasMovedRef.current = true
      clearLongPressTimer()
      store.getState().setDragging(true)

      // Tauri：延迟调用 startDragging，只在真正拖拽时才触发
      if (isTauri && tauriWindow) {
        tauriWindow.getCurrentWindow().startDragging().catch(() => {})
      } else {
        // 浏览器模式：播放拖拽音效
        audioManager.play('drag')
      }
    }

    // 非拖拽模式或 Tauri 模式下不手动更新位置（Tauri 的 startDragging 接管了窗口移动）
    if (isDraggingActiveRef.current && !isTauri) {
      // 记录速度采样
      velocitySamplesRef.current.push({ x: e.clientX, y: e.clientY, t: Date.now() })
      if (velocitySamplesRef.current.length > VELOCITY_SAMPLES) {
        velocitySamplesRef.current.shift()
      }

      getPhysics().stretch(PET_CENTER_X + dx, PET_CENTER_Y + dy)
    }
  }, [PET_CENTER_X, PET_CENTER_Y, store, getPhysics, clearLongPressTimer])

  // ---- mouseup：结束拖拽 ----
  const handleMouseUp = useCallback(() => {
    clearLongPressTimer()

    const s = store.getState()
    if (isDraggingActiveRef.current) {
      if (!isTauri) {
        // 计算惯性抛出速度
        const vx = computeFlingVelocity(velocitySamplesRef.current, 'x')
        const vy = computeFlingVelocity(velocitySamplesRef.current, 'y')

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
    isDraggingActiveRef.current = false
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

  const recent = samples.slice(-3)
  const first = recent[0]
  const last = recent[recent.length - 1]
  const dt = last.t - first.t

  if (dt === 0) return 0

  const dx = (last[axis] - first[axis]) / (dt / 16.67)

  return Math.max(-20, Math.min(20, dx))
}
