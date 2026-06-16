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
