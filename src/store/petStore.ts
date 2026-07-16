import { create } from 'zustand'
import type { PetMood, PetAction, ChatMessage } from '../pet/types'

// ============================================
// 宠物全局状态 — Zustand Store
// 替代 App.tsx 中散落的 useState + useRef + petStateRef
// ============================================

export type PanelType = 'note' | 'remind' | 'search' | 'translate' | 'weather' | 'settings' | null

interface PetStore {
  // ---- 核心状态 ----
  mood: PetMood
  action: PetAction
  isDragging: boolean
  isChatOpen: boolean
  isQuickPanelOpen: boolean
  isReady: boolean
  activePanel: PanelType
  reminderNotif: { icon: string; text: string } | null
  currentModel: string
  petName: string
  messages: ChatMessage[]

  // 交互时间（用于状态机判断闲置时长）
  lastInteractionTime: number

  // ---- Actions ----
  setMood: (mood: PetMood) => void
  setAction: (action: PetAction) => void
  setDragging: (v: boolean) => void
  setChatOpen: (v: boolean) => void
  setQuickPanelOpen: (open: boolean) => void
  toggleQuickPanel: () => void
  setReady: (v: boolean) => void
  setActivePanel: (p: PanelType) => void
  setReminderNotif: (n: { icon: string; text: string } | null) => void
  setCurrentModel: (m: string) => void
  setPetName: (name: string) => void
  addMessage: (msg: ChatMessage) => void
  setMessages: (msgs: ChatMessage[]) => void
  updateInteraction: () => void
  toggleChat: () => void
}

export const usePetStore = create<PetStore>((set) => ({
  // ---- 初始状态 ----
  mood: 'happy',
  action: 'idle_stand',
  isDragging: false,
  isChatOpen: false,
  isQuickPanelOpen: false,
  isReady: false,
  activePanel: null,
  reminderNotif: null,
  currentModel: 'zhanlu/glm-5.1',
  petName: '小光',
  messages: [],
  lastInteractionTime: Date.now(),

  // ---- Actions ----
  setMood: (mood) => set({ mood }),
  setAction: (action) => set({ action }),
  setDragging: (isDragging) => set({ isDragging }),
  setChatOpen: (isChatOpen) => set({ isChatOpen }),
  setQuickPanelOpen: (isQuickPanelOpen) => set({ isQuickPanelOpen }),
  toggleQuickPanel: () => set((s) => ({ isQuickPanelOpen: !s.isQuickPanelOpen })),
  setReady: (isReady) => set({ isReady }),
  setActivePanel: (activePanel) => set({ activePanel }),
  setReminderNotif: (reminderNotif) => set({ reminderNotif }),
  setCurrentModel: (currentModel) => set({ currentModel }),
  setPetName: (petName) => set({ petName }),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setMessages: (messages) => set({ messages }),
  updateInteraction: () => set({ lastInteractionTime: Date.now() }),
  toggleChat: () => set((s) => ({ isChatOpen: !s.isChatOpen })),
}))
