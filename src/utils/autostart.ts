// ============================================
// 开机自启工具 — 封装 @tauri-apps/plugin-autostart
// ============================================

const isTauri = !!window.__TAURI_INTERNALS__

/** 设置开机自启 */
export async function setAutoStart(enabled: boolean): Promise<void> {
  if (!isTauri) return
  try {
    const autostart = await import('@tauri-apps/plugin-autostart')
    if (enabled) {
      await autostart.enable()
    } else {
      await autostart.disable()
    }
  } catch (err) {
    console.warn('[autostart] failed:', err)
  }
}

/** 查询开机自启是否已启用 */
export async function isAutoStartEnabled(): Promise<boolean> {
  if (!isTauri) return false
  try {
    const autostart = await import('@tauri-apps/plugin-autostart')
    return await autostart.isEnabled()
  } catch {
    return false
  }
}
