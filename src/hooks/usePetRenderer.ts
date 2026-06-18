import { useRef, useEffect } from 'react'
import {
  StateMachine,
  BehaviorTree,
  PixelRenderer,
  ParticleSystem,
  SpringPhysics2D,
  getThemeBySkin,
  type SkinId,
} from '../pet'
import { usePetStore } from '../store/petStore'

// ============================================
// 宠物渲染 Hook — Canvas 生命周期 + 渲染循环
// 含边界碰撞检测
// ============================================

const CANVAS_W = 300
const CANVAS_H = 350
const PET_CENTER_X = CANVAS_W / 2
const PET_CENTER_Y = CANVAS_H / 2 + 20

/** 宠物可移动范围（Canvas 内坐标） */
const PET_MIN_X = 30
const PET_MAX_X = CANVAS_W - 30
const PET_MIN_Y = 30
const PET_MAX_Y = CANVAS_H - 20

export function usePetRenderer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pixelRendererRef = useRef<PixelRenderer | null>(null)
  const animFrameRef = useRef(0)
  const lastTimeRef = useRef(performance.now())

  // 核心系统实例（不需要响应式，用 ref）
  const stateMachineRef = useRef(new StateMachine())
  const behaviorTreeRef = useRef(new BehaviorTree())
  const particleSystemRef = useRef(new ParticleSystem())
  const physicsRef = useRef(new SpringPhysics2D(PET_CENTER_X, PET_CENTER_Y))

  // 边缘碰撞状态
  const lastBounceRef = useRef<{ x: 'none' | 'min' | 'max' | 'both'; y: 'none' | 'min' | 'max' | 'both' }>({ x: 'none', y: 'none' })

  const { setReady, setMood, setAction, addMessage, isReady } = usePetStore()

  // 暴露给其他 hooks 的引用
  const getStateMachine = () => stateMachineRef.current
  const getParticleSystem = () => particleSystemRef.current
  const getPhysics = () => physicsRef.current

  // ---- 初始化 ----
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const saved = JSON.parse(localStorage.getItem('pet_settings') || '{}')
    const theme = getThemeBySkin((saved.skin || 'lumie') as SkinId)
    const ctx = canvas.getContext('2d')!
    const renderer = new PixelRenderer(ctx, theme)

    renderer.init().then(() => {
      pixelRendererRef.current = renderer
      setReady(true)

      const greeting = stateMachineRef.current.getRandomGreeting()
      addMessage({
        id: crypto.randomUUID(),
        role: 'pet',
        content: greeting,
        timestamp: Date.now(),
      })
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- 状态机回调 ----
  useEffect(() => {
    const unsub = stateMachineRef.current.onChange((newMood, newAction) => {
      setMood(newMood)
      setAction(newAction)
    })
    return () => unsub()
  }, [setMood, setAction])

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

    const store = usePetStore.getState

    const loop = (now: number) => {
      const delta = now - lastTimeRef.current
      lastTimeRef.current = now

      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)

      // 更新物理
      const pos = physics.update()

      // 边界碰撞检测（惯性滑动时）
      if (physics.isSliding) {
        const bounce = physics.bounce(PET_MIN_X, PET_MAX_X, PET_MIN_Y, PET_MAX_Y, 0.4)

        // 碰壁时发射粒子
        if (bounce.x !== 'none' && lastBounceRef.current.x === 'none') {
          particles.emit('sparkle', pos.x, pos.y, 4, { spread: 20 })
          sm.setMood('surprised')
        }
        if (bounce.y !== 'none' && lastBounceRef.current.y === 'none') {
          particles.emit('sparkle', pos.x, pos.y, 4, { spread: 20 })
        }
        lastBounceRef.current = bounce

        // 惯性结束后回弹到中心
        if (!physics.isSliding) {
          physics.setTarget(PET_CENTER_X, PET_CENTER_Y)
          sm.setMood('happy')
        }
      } else {
        lastBounceRef.current = { x: 'none', y: 'none' }
      }

      // 构建 PetState 供行为树和状态机使用
      const petState = {
        mood: store().mood,
        action: store().action,
        position: { x: pos.x, y: pos.y },
        scale: 1.0,
        lastInteractionTime: store().lastInteractionTime,
        isDragging: store().isDragging,
        isChatOpen: store().isChatOpen,
      }

      const currentAction = bt.tick(petState, delta)
      store().setAction(currentAction)

      if (Math.floor(now / 1000) !== Math.floor((now - delta) / 1000)) {
        sm.tick(petState)
      }

      renderer.tick(delta)
      renderer.draw(sm.mood, currentAction, pos.x, pos.y, now, 1.0)
      particles.update(delta)
      particles.draw(ctx)

      animFrameRef.current = requestAnimationFrame(loop)
    }

    animFrameRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [isReady, setAction, setMood])

  // ---- 打盹粒子 ----
  useEffect(() => {
    const interval = setInterval(() => {
      if (stateMachineRef.current.mood === 'sleeping') {
        particleSystemRef.current.emit('zzz', PET_CENTER_X, PET_CENTER_Y - 50, 1, { speed: 0.5, size: 0.8 })
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  /** 切换皮肤后重新初始化渲染器 */
  const reinitTheme = async (theme: Parameters<PixelRenderer['reinit']>[0]) => {
    if (pixelRendererRef.current) {
      await pixelRendererRef.current.reinit(theme)
      particleSystemRef.current.emit('sparkle', PET_CENTER_X, PET_CENTER_Y - 20, 8)
    }
  }

  return {
    canvasRef,
    CANVAS_W,
    CANVAS_H,
    PET_CENTER_X,
    PET_CENTER_Y,
    reinitTheme,
    getStateMachine,
    getParticleSystem,
    getPhysics,
  }
}
