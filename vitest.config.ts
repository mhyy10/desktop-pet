import { defineConfig } from 'vitest/config'

// ============================================
// Vitest 配置 — 记忆系统单测
// environment: node（记忆逻辑为纯 TS，不依赖 DOM）
// IndexedDB 通过 ConversationMemory 的可注入 storage 接口 mock，不依赖真实浏览器
// ============================================
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globals: false,
  },
})
