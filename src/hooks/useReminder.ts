import { useRef, useEffect, useCallback } from 'react'
import { ReminderScheduler, type ProactiveReminder } from '../pet'
import { loadReminders, markReminderFired, type Reminder } from '../utils/storage'
import { usePetStore } from '../store/petStore'

// ============================================
// 提醒 Hook — 主动提醒 + 自定义提醒调度
// 从 App.tsx 提取
// ============================================

export function useReminder(
  getParticleSystem: () => import('../pet').ParticleSystem,
  getStateMachine: () => import('../pet').StateMachine,
  PET_CENTER_X: number,
  PET_CENTER_Y: number,
) {
  const reminderSchedulerRef = useRef(new ReminderScheduler())
  const reminderTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const store = usePetStore

  // ---- 初始化主动提醒调度器 ----
  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('pet_settings') || '{}')
    const scheduler = reminderSchedulerRef.current

    scheduler.updateConfig({
      enabled: saved.reminderEnabled ?? true,
      intervalMinutes: saved.reminderInterval ?? 60,
    })

    scheduler.onFire((r: ProactiveReminder) => {
      store.getState().setReminderNotif({ icon: r.icon, text: r.text })
      getParticleSystem().emit('sparkle', PET_CENTER_X, PET_CENTER_Y - 30, 6)
      getStateMachine().setMood('excited')
      setTimeout(() => store.getState().setReminderNotif(null), 5000)
    })

    scheduler.start()
    return () => { scheduler.stop() }
  }, [PET_CENTER_X, PET_CENTER_Y, store, getParticleSystem, getStateMachine])

  // ---- 恢复未触发的提醒定时器 ----
  useEffect(() => {
    const pending = loadReminders().filter((r) => !r.fired && r.time > Date.now())
    pending.forEach((r) => scheduleReminder(r))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- 调度自定义提醒 ----
  const scheduleReminder = useCallback((r: Reminder) => {
    const delay = r.time - Date.now()
    if (delay <= 0) return

    const timer = setTimeout(() => {
      store.getState().setReminderNotif({ icon: '⏰', text: r.text })
      getParticleSystem().emit('sparkle', PET_CENTER_X, PET_CENTER_Y - 30, 8)
      getStateMachine().setMood('excited')
      markReminderFired(r.id)
      reminderTimersRef.current.delete(r.id)

      setTimeout(() => store.getState().setReminderNotif(null), 5000)
    }, delay)

    reminderTimersRef.current.set(r.id, timer)
  }, [PET_CENTER_X, PET_CENTER_Y, store, getParticleSystem, getStateMachine])

  /** 同步提醒设置变更 */
  const updateReminderConfig = useCallback((opts: { enabled?: boolean; intervalMinutes?: number }) => {
    reminderSchedulerRef.current.updateConfig(opts)
  }, [])

  return { scheduleReminder, updateReminderConfig }
}
