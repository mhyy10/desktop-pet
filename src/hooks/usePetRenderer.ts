import { useRef, useEffect } from 'react'
import {
  StateMachine,
  BehaviorTree,
  ParticleSystem,
  SpringPhysics2D,
  OffscreenLayer,
  FrameRateController,
  isStaticAction,
  getThemeBySkin,
  createRenderer,
  type IRenderer,
  type SkinId,
  type RendererType,
  type PetMood,
  type PetAction,
  type PetTheme,
} from '../pet'
import { loadSettings } from '../utils/storage'
import { usePetStore } from '../store/petStore'

// ============================================
// 宠物渲染 Hook — Canvas 生命周期 + 渲染循环
// 离屏缓存 + 智能帧率 + 可见性检测
// ============================================

const CANVAS_W = 300
const CANVAS_H = 350
const PET_CENTER_X = CANVAS_W / 2
const PET_CENTER_Y = CANVAS_H / 2 + 20

const PET_MIN_X = 30
const PET_MAX_X = CANVAS_W - 30
const PET_MIN_Y = 30
const PET_MAX_Y = CANVAS_H - 20

/** Tauri 环境 */
const isTauri = !!window.__TAURI_INTERNALS__

export function usePetRenderer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<IRenderer | null>(null)
  const offscreenRef = useRef<OffscreenLayer | null>(null)
  const fpsRef = useRef(new FrameRateController())
  const animFrameRef = useRef(0)
  const lastTimeRef = useRef(performance.now())

  const prevMoodRef = useRef<PetMood | null>(null)
  const prevActionRef = useRef<PetAction | null>(null)

  const stateMachineRef = useRef(new StateMachine())
  const behaviorTreeRef = useRef(new BehaviorTree())
  const particleSystemRef = useRef(new ParticleSystem())
  const physicsRef = useRef(new SpringPhysics2D(PET_CENTER_X, PET_CENTER_Y))
  const lastBounceRef = useRef<{ x: 'none' | 'min' | 'max' | 'both'; y: 'none' | 'min' | 'max' | 'both' }>({ x: 'none', y: 'none' })

  // 防止 React StrictMode 开发模式双调用导致 offscreenRef 与 rendererRef 指向不同实例
  // （StrictMode 会挂载→卸载→重挂 effect：第二次创建新 OffscreenLayer，但第一次的
  //  renderer.init() 异步回调仍会把 rendererRef 指向旧 offscreen 的 ctx，造成 draw 与
  //  composite 操作在两个不同 canvas 上 → 主画布空白）
  const initVersionRef = useRef(0)

  const { setReady, setMood, setAction, addMessage, isReady } = usePetStore()

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

    // 每次 effect 执行都重新创建 offscreen + renderer，保证二者引用同一实例
    const offscreen = new OffscreenLayer(CANVAS_W, CANVAS_H)
    offscreenRef.current = offscreen
    const renderer = createRenderer(rendererType, offscreen.petCtx, theme, saved.skin || 'lumie')

    // 本轮 init 的版本号；若已被新一轮 effect 取代则丢弃回调结果
    const version = ++initVersionRef.current

    renderer.init().then(() => {
      // StrictMode 卸载重挂、或 effect 重跑导致 offscreenRef 已被替换 → 丢弃本次结果
      if (version !== initVersionRef.current) return
      rendererRef.current = renderer
      setReady(true)
      addMessage({
        id: crypto.randomUUID(),
        role: 'pet',
        content: stateMachineRef.current.getRandomGreeting(),
        timestamp: Date.now(),
      })
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- 可见性检测 ----
  useEffect(() => {
    const handleVisibility = () => {
      fpsRef.current.setVisible(!document.hidden)
      if (!document.hidden) fpsRef.current.reset()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    // Tauri 窗口焦点
    let unlisten: (() => void) | null = null
    if (isTauri) {
      import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
        const win = getCurrentWindow()
        win.onFocusChanged(({ payload: focused }) => {
          fpsRef.current.setVisible(focused)
          if (focused) fpsRef.current.reset()
        }).then((fn) => { unlisten = fn })
      })
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      unlisten?.()
    }
  }, [])

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
    const fps = fpsRef.current
    const particles = particleSystemRef.current
    const physics = physicsRef.current
    const sm = stateMachineRef.current
    const bt = behaviorTreeRef.current

    const store = usePetStore.getState

    const loop = (now: number) => {
      animFrameRef.current = requestAnimationFrame(loop)

      const s = store()
      const isDragging = s.isDragging
      const isChatOpen = s.isChatOpen

      // 智能帧率：跳过不需要渲染的帧
      if (!fps.shouldRender(now, s.action, isDragging, isChatOpen)) {
        // 不可见时仍需更新 lastTimeRef，避免恢复后 delta 暴涨
        lastTimeRef.current = now
        return
      }

      const delta = now - lastTimeRef.current
      lastTimeRef.current = now

      // 更新物理
      const pos = physics.update()

      // 边界碰撞检测
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

      // PetState
      const petState = {
        mood: s.mood,
        action: s.action,
        position: { x: pos.x, y: pos.y },
        scale: 1.0,
        lastInteractionTime: s.lastInteractionTime,
        isDragging,
        isChatOpen,
      }

      const currentAction = bt.tick(petState, delta)
      s.setAction(currentAction)

      if (Math.floor(now / 1000) !== Math.floor((now - delta) / 1000)) {
        sm.tick(petState)
      }

      const currentMood = sm.mood

      // 离屏缓存：宠物层
      // mood/action 变化 OR 动画帧变化（非静态 action）→ 标记脏
      const moodChanged = currentMood !== prevMoodRef.current
      const actionChanged = currentAction !== prevActionRef.current

      const tickResult = renderer.tick(delta)

      if (moodChanged || actionChanged) {
        offscreen.markPetDirty()
        prevMoodRef.current = currentMood
        prevActionRef.current = currentAction
      }

      if (tickResult.frameChanged && !isStaticAction(currentAction)) {
        offscreen.markPetDirty()
      }

      if (offscreen.isPetDirty) {
        offscreen.clearPet()
        renderer.draw(currentMood, currentAction, pos.x, pos.y, now, 1.0)
        offscreen.clearPetDirty()
      }

      // 离屏缓存：粒子层
      particles.update(delta)
      if (particles.count > 0) {
        offscreen.clearParticle()
        particles.draw(offscreen.particleCtx)
        offscreen.clearParticleDirty()
      } else if (offscreen.isParticleDirty) {
        offscreen.clearParticle()
        offscreen.clearParticleDirty()
      }

      // 合成
      offscreen.composite(ctx)
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

  const reinitTheme = async (theme: Parameters<IRenderer['reinit']>[0]) => {
    if (rendererRef.current) {
      await rendererRef.current.reinit(theme)
      offscreenRef.current?.markPetDirty()
      particleSystemRef.current.emit('sparkle', PET_CENTER_X, PET_CENTER_Y - 20, 8)
    }
  }

  /** 切换渲染器类型（pixel/canvas） */
  const reinitRenderer = async (type: RendererType, theme: PetTheme, skinId: string = 'lumie') => {
    if (!offscreenRef.current) return
    const renderer = createRenderer(type, offscreenRef.current.petCtx, theme, skinId)
    await renderer.init()
    rendererRef.current = renderer
    offscreenRef.current.markPetDirty()
    particleSystemRef.current.emit('sparkle', PET_CENTER_X, PET_CENTER_Y - 20, 8)
  }

  return {
    canvasRef, CANVAS_W, CANVAS_H, PET_CENTER_X, PET_CENTER_Y,
    reinitTheme, reinitRenderer, getStateMachine, getParticleSystem, getPhysics,
  }
}
