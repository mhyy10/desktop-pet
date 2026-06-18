import { useRef, useEffect, useCallback } from 'react'
import { ChatEngine } from '../ai'
import { getThemeBySkin, type SkinId } from '../pet'
import { loadSettings, type PetSettings } from '../utils/storage'
import { usePetStore, type PanelType } from '../store/petStore'

// ============================================
// AI 对话 Hook — ChatEngine + 设置变更 + 托盘事件
// 从 App.tsx 提取
// ============================================

const isTauri = !!window.__TAURI_INTERNALS__

export function useChat(
  reinitTheme: (theme: Parameters<import('../pet').PixelRenderer['reinit']>[0]) => void,
  getParticleSystem: () => import('../pet').ParticleSystem,
  getStateMachine: () => import('../pet').StateMachine,
  PET_CENTER_X: number,
  PET_CENTER_Y: number,
) {
  const chatEngineRef = useRef(new ChatEngine())
  const store = usePetStore

  // ---- 初始化 ChatEngine 配置 ----
  useEffect(() => {
    const saved = loadSettings()
    chatEngineRef.current.updateConfig({
      apiKey: saved.apiKey || undefined,
      baseUrl: saved.baseUrl,
      model: saved.model,
    })
    store.getState().setCurrentModel(saved.model)
  }, [store])

  // ---- 监听托盘事件（打开设置） ----
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
      const reply = await chatEngineRef.current.chat(text)
      s.addMessage({
        id: crypto.randomUUID(),
        role: 'pet',
        content: reply,
        timestamp: Date.now(),
      })
      getStateMachine().setMood('happy')
      getParticleSystem().emit('heart', PET_CENTER_X, PET_CENTER_Y - 20, 3)
    } catch {
      getStateMachine().setMood('bored')
    }
  }, [PET_CENTER_X, PET_CENTER_Y, store, getParticleSystem, getStateMachine])

  // ---- 侧边栏动作 ----
  const handleQuickAction = useCallback((actionId: string) => {
    const s = store.getState()
    if (['note', 'remind', 'search', 'translate', 'weather', 'settings'].includes(actionId)) {
      s.setActivePanel(s.activePanel === actionId ? null : (actionId as PanelType))
    }
  }, [store])

  // ---- 设置变更回调 ----
  const handleSettingsChange = useCallback((settings: PetSettings) => {
    const s = store.getState()
    s.setCurrentModel(settings.model)

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
