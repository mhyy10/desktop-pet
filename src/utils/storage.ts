// ============================================
// 本地存储封装
// ============================================

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // quota exceeded etc.
  }
}

// ---- 笔记 ----

export interface Note {
  id: string
  text: string
  time: number
}

const NOTES_KEY = 'pet_notes'

export function loadNotes(): Note[] {
  return read<Note[]>(NOTES_KEY, [])
}

export function saveNotes(notes: Note[]): void {
  // 最多保留 50 条
  write(NOTES_KEY, notes.slice(-50))
}

export function addNote(text: string): Note[] {
  const notes = loadNotes()
  notes.push({ id: crypto.randomUUID(), text, time: Date.now() })
  saveNotes(notes)
  return notes
}

export function deleteNote(id: string): Note[] {
  const notes = loadNotes().filter((n) => n.id !== id)
  saveNotes(notes)
  return notes
}

// ---- 提醒 ----

export interface Reminder {
  id: string
  text: string
  time: number // 触发时间戳
  fired: boolean
}

const REMINDERS_KEY = 'pet_reminders'

export function loadReminders(): Reminder[] {
  return read<Reminder[]>(REMINDERS_KEY, [])
}

export function saveReminders(reminders: Reminder[]): void {
  write(REMINDERS_KEY, reminders)
}

export function addReminder(text: string, delayMinutes: number): Reminder[] {
  const reminders = loadReminders()
  reminders.push({
    id: crypto.randomUUID(),
    text,
    time: Date.now() + delayMinutes * 60_000,
    fired: false,
  })
  saveReminders(reminders)
  return reminders
}

export function markReminderFired(id: string): Reminder[] {
  const reminders = loadReminders().map((r) =>
    r.id === id ? { ...r, fired: true } : r
  )
  saveReminders(reminders)
  return reminders
}

export function deleteReminder(id: string): Reminder[] {
  const reminders = loadReminders().filter((r) => r.id !== id)
  saveReminders(reminders)
  return reminders
}

// ---- 设置 ----

export interface PetSettings {
  apiKey: string
  baseUrl: string
  model: string
  petName: string
  skin: string
  autoStart: boolean
  reminderEnabled: boolean
  reminderInterval: number // 分钟
  soundEnabled: boolean
  soundVolume: number // 0~1
}

const SETTINGS_KEY = 'pet_settings'

const DEFAULT_SETTINGS: PetSettings = {
  apiKey: '',
  baseUrl: 'http://10.155.208.190:31114/aigateway/v1',
  model: 'zhanlu/glm-5.1',
  petName: '小光',
  skin: 'lumie',
  autoStart: false,
  reminderEnabled: true,
  reminderInterval: 60,
  soundEnabled: true,
  soundVolume: 0.3,
}

export function loadSettings(): PetSettings {
  return read<PetSettings>(SETTINGS_KEY, DEFAULT_SETTINGS)
}

export function saveSettings(settings: PetSettings): void {
  write(SETTINGS_KEY, settings)
}

/** 更新部分设置项 */
export function updateSettings(patch: Partial<PetSettings>): PetSettings {
  const current = loadSettings()
  const merged = { ...current, ...patch }
  saveSettings(merged)
  return merged
}
