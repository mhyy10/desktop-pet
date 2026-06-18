import { useRef, useCallback } from 'react'
import { usePetStore } from '../store/petStore'
import type { StateMachine, ParticleSystem, SpringPhysics2D } from '../pet'

// ============================================
// 宠物交互 Hook — 拖拽 + 点击
// 从 App.tsx 提取
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

  const store = usePetStore

  // ---- 点击宠物 ----
  const handlePetClick = useCallback(() => {
    if (hasMovedRef.current) return
    const s = store.getState()
    s.updateInteraction()
    getStateMachine().setMood('happy')
    getParticleSystem().emit('sparkle', PET_CENTER_X, PET_CENTER_Y - 20, 6)
    s.setChatOpen(true)
  }, [PET_CENTER_X, PET_CENTER_Y, store, getStateMachine, getParticleSystem])

  // ---- 拖拽 ----
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    isDragTrackingRef.current = true
    hasMovedRef.current = false
    dragStartRef.current = { x: e.clientX, y: e.clientY }

    if (isTauri && tauriWindow) {
      tauriWindow.getCurrentWindow().startDragging().catch(() => {})
      store.getState().setDragging(true)
    }
  }, [store])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragTrackingRef.current || isTauri) return

    const dx = e.clientX - (dragStartRef.current?.x ?? 0)
    const dy = e.clientY - (dragStartRef.current?.y ?? 0)

    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      const s = store.getState()
      if (!s.isDragging) {
        s.setDragging(true)
      }
      hasMovedRef.current = true
      getPhysics().stretch(PET_CENTER_X + dx, PET_CENTER_Y + dy)
    }
  }, [PET_CENTER_X, PET_CENTER_Y, store, getPhysics])

  const handleMouseUp = useCallback(() => {
    const s = store.getState()
    if (s.isDragging) {
      if (!isTauri) {
        getPhysics().setTarget(PET_CENTER_X, PET_CENTER_Y)
      }
      getParticleSystem().emit('star', PET_CENTER_X, PET_CENTER_Y, 4)
      s.setDragging(false)
    }
    isDragTrackingRef.current = false
    dragStartRef.current = null
  }, [PET_CENTER_X, PET_CENTER_Y, store, getPhysics, getParticleSystem])

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
