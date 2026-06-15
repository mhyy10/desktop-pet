/// <reference types="vite/client" />

// Tauri 环境检测
interface Window {
  __TAURI_INTERNALS__?: unknown
}
