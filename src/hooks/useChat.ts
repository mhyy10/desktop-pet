import { useRef, useEffect, useCallback } from 'react'
import { ChatEngine, ProactiveEngine, analyzeMood } from '../ai'
import { getThemeBySkin, audioManager, type SkinId, type IRenderer } from '../pet'
import { loadSettings, type PetSettings } from '../utils/storage'
import { usePetStore } from '../store/petStore'

// ============================================
// AI 对话 Hook — ChatEngine + 主动对话 + 情绪联动
// ============================================

const isTauri = !!window.__TAURI_INTERNALS__

export function useChat(
  reinitTheme: (theme: Parameters<IRenderer['reinit']>[0]) => void,
  getParticleSystem: () => import('../pet').ParticleSystem,
  getStateMachine: () => import('../pet').StateMachine,
  PET_CENTER_X: number,
  PET_CENTER_Y: number,
) {
  const chatEngineRef = useRef(new ChatEngine())
  const proactiveRef = useRef(new ProactiveEngine())
  const store = usePetStore

  // ---- 初始化 ChatEngine 配置 ----
  useEffect(() => {
    const saved = loadSettings()
    chatEngineRef.current.updateConfig({
      apiKey: saved.apiKey || undefined,
      baseUrl: saved.baseUrl,
      model: saved.model,
      petName: saved.petName || '小光',
    })
    store.getState().setCurrentModel(saved.model)

    // 同步音效设置
    audioManager.setEnabled(saved.soundEnabled)
    audioManager.setVolume(saved.soundVolume)
  }, [store])

  // ---- 监听托盘事件 ----
  useEffect(() => {
    if (!isTauri) return
    let unlisten: (() => void) | null = null
    import('@tauri-apps/api/event').then((m) => {
      m.listen('tray-open-settings', () => {
        store.getState().setActivePanel('settings')
      }).then((fn) => { unlisten = fn })
    })
    return () => { unlisten?.() }
  }, [store])

  // ---- 主动对话定时检查 ----
  useEffect(() => {
    const interval = setInterval(() => {
      const s = store.getState()
      if (s.isDragging || s.isChatOpen) return

      const petState = {
        mood: s.mood,
        action: s.action,
        position: { x: 0, y: 0 },
        scale: 1.0,
        lastInteractionTime: s.lastInteractionTime,
        isDragging: false,
        isChatOpen: false,
      }

      const message = proactiveRef.current.check(petState, chatEngineRef.current.conversationMemory)
      if (message) {
        s.addMessage({
          id: crypto.randomUUID(),
          role: 'pet',
          content: message,
          timestamp: Date.now(),
        })
        audioManager.play('greet')
      }
    }, 15_000) // 每15秒检查一次
    return () => clearInterval(interval)
  }, [store])

  // ---- 发送消息 ----
  const handleSendMessage = useCallback(async (text: string) => {
    const s = store.getState()
    s.updateInteraction()
    s.addMessage({
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    })

    getStateMachine().setMood('thinking')
    getParticleSystem().emit('sparkle', PET_CENTER_X, PET_CENTER_Y - 30, 3, { size: 0.6 })

    try {
      const reply = await chatEngineRef.current.chat(text, s.mood)
      s.addMessage({
        id: crypto.randomUUID(),
        role: 'pet',
        content: reply,
        timestamp: Date.now(),
      })

      // 情绪联动：分析回复情感影响心情
      const replyMood = analyzeMood(reply)
      if (replyMood) {
        getStateMachine().setMood(replyMood)
      } else {
        getStateMachine().setMood('happy')
      }

      getParticleSystem().emit('heart', PET_CENTER_X, PET_CENTER_Y - 20, 3)
      audioManager.play('greet')
    } catch {
      getStateMachine().setMood('bored')
    }
  }, [PET_CENTER_X, PET_CENTER_Y, store, getParticleSystem, getStateMachine])

  // ---- 侧边栏动作 ----
  const handleQuickAction = useCallback((actionId: string) => {
    const s = store.getState()
    if (['note', 'remind', 'search', 'translate', 'weather', 'settings'].includes(actionId)) {
      s.setActivePanel(s.activePanel === actionId ? null : (actionId as import('../store/petStore').PanelType))
    }
  }, [store])

  // ---- 设置变更回调 ----
  const handleSettingsChange = useCallback((settings: PetSettings) => {
    const s = store.getState()
    s.setCurrentModel(settings.model)

    audioManager.setEnabled(settings.soundEnabled)
    audioManager.setVolume(settings.soundVolume)

    // 更新宠物名字到 ChatEngine
    chatEngineRef.current.updateConfig({ petName: settings.petName || '小光' })

    // 切换皮肤 → 重新生成精灵图
    const theme = getThemeBySkin((settings.skin || 'lumie') as SkinId)
    reinitTheme(theme)
  }, [store, reinitTheme])

  return {
    chatEngine: chatEngineRef.current,
    handleSendMessage,
    handleQuickAction,
    handleSettingsChange,
  }
}
