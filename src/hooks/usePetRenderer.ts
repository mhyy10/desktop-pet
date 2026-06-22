import { useRef, useEffect } from 'react'
import {
  StateMachine,
  BehaviorTree,
  ParticleSystem,
  SpringPhysics2D,
  OffscreenLayer,
  getThemeBySkin,
  createRenderer,
  type IRenderer,
  type SkinId,
  type RendererType,
  type PetMood,
  type PetAction,
} from '../pet'
import { loadSettings } from '../utils/storage'
import { usePetStore } from '../store/petStore'

// ============================================
// 宠物渲染 Hook — Canvas 生命周期 + 渲染循环
// 含边界碰撞检测 + 离屏缓存
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
  const rendererRef = useRef<IRenderer | null>(null)
  const offscreenRef = useRef<OffscreenLayer | null>(null)
  const animFrameRef = useRef(0)
  const lastTimeRef = useRef(performance.now())

  // 上一帧的状态，用于脏标记检测
  const prevMoodRef = useRef<PetMood | null>(null)
  const prevActionRef = useRef<PetAction | null>(null)

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

    const saved = loadSettings()
    const theme = getThemeBySkin((saved.skin || 'lumie') as SkinId)
    const rendererType = (saved.rendererType || 'pixel') as RendererType

    // 创建离屏缓存层
    offscreenRef.current = new OffscreenLayer(CANVAS_W, CANVAS_H)

    // 用离屏宠物层 ctx 创建渲染器
    const renderer = createRenderer(rendererType, offscreenRef.current.petCtx, theme)

    renderer.init().then(() => {
      rendererRef.current = renderer
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
    const renderer = rendererRef.current!
    const offscreen = offscreenRef.current!
    const particles = particleSystemRef.current
    const physics = physicsRef.current
    const sm = stateMachineRef.current
    const bt = behaviorTreeRef.current

    const store = usePetStore.getState

    const loop = (now: number) => {
      const delta = now - lastTimeRef.current
      lastTimeRef.current = now

      // 更新物理
      const pos = physics.update()

      // 边界碰撞检测（惯性滑动时）
      if (physics.isSliding) {
        const bounce = physics.bounce(PET_MIN_X, PET_MAX_X, PET_MIN_Y, PET_MAX_Y, 0.4)

        if (bounce.x !== 'none' && lastBounceRef.current.x === 'none') {
          particles.emit('sparkle', pos.x, pos.y, 4, { spread: 20 })
          sm.setMood('surprised')
        }
        if (bounce.y !== 'none' && lastBounceRef.current.y === 'none') {
          particles.emit('sparkle', pos.x, pos.y, 4, { spread: 20 })
        }
        lastBounceRef.current = bounce

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

      const currentMood = sm.mood

      // ---- 离屏缓存：宠物层只在 mood/action 变化时重绘 ----
      if (currentMood !== prevMoodRef.current || currentAction !== prevActionRef.current) {
        offscreen.markPetDirty()
        prevMoodRef.current = currentMood
        prevActionRef.current = currentAction
      }

      if (offscreen.isPetDirty) {
        offscreen.clearPet()
        renderer.tick(delta)
        renderer.draw(currentMood, currentAction, pos.x, pos.y, now, 1.0)
        offscreen.clearPetDirty()
      } else {
        // 宠物层没变，仍需推进动画帧
        renderer.tick(delta)
      }

      // ---- 粒子层：有粒子就重绘 ----
      particles.update(delta)
      if (particles.count > 0) {
        offscreen.clearParticle()
        particles.draw(offscreen.particleCtx)
        offscreen.clearParticleDirty()
      } else if (offscreen.isParticleDirty) {
        offscreen.clearParticle()
        offscreen.clearParticleDirty()
      }

      // ---- 合成到主 Canvas ----
      offscreen.composite(ctx)

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
  const reinitTheme = async (theme: Parameters<IRenderer['reinit']>[0]) => {
    if (rendererRef.current) {
      await rendererRef.current.reinit(theme)
      offscreenRef.current?.markPetDirty()
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
