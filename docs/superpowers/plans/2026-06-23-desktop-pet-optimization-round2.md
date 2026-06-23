# 桌面宠物优化 Round 2 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复三阶段实现中的关键 bug，补齐遗漏功能，为后续新特性打基础

**Architecture:** 在已有 IRenderer/OffscreenLayer/FrameRateController 架构上修复渲染缓存逻辑，补齐 AI 主动对话 LLM 触发，完善设置面板和 Zustand store

**Tech Stack:** Tauri 2.0 + React 19 + TypeScript + Zustand 5 + Canvas 2D

## Global Constraints

- TypeScript strict mode，`npx tsc --noEmit` 必须通过
- 所有新代码遵循现有注释风格（`// ============` 分隔块注释）
- 不引入新 npm 依赖（tauri-plugin-autostart 除外）
- 每个独立改动完成后 `git commit`
- IndexedDB 操作必须 try/catch 静默降级

---

### Task 1: 修复 OffscreenLayer 动画冻结 Bug（关键）

**问题：** `usePetRenderer.ts` L198-211 中，宠物层仅在 mood/action 变化时标记脏。但动画帧持续推进（`renderer.tick()` 改变 currentFrame），当 action 不变时 `isPetDirty=false` → `renderer.draw()` 不调用 → 宠物冻结。

**Files:**
- Modify: `src/pet/OffscreenLayer.ts`
- Modify: `src/hooks/usePetRenderer.ts`
- Modify: `src/pet/AnimationController.ts`

**Interfaces:**
- Consumes: `AnimationController.currentFrame` (已有)
- Produces: `OffscreenLayer` 新增动画感知脏标记；`usePetRenderer` 渲染循环正确判断是否需要重绘

- [ ] **Step 1: AnimationController 暴露帧变化检测**

在 `AnimationController.ts` 中新增 `hasFrameChanged` 属性：

```typescript
// 在 AnimationController 类中新增
private _prevFrameIndex: number = -1

/** 上一帧的帧索引，用于检测帧是否变化 */
get hasFrameChanged(): boolean {
  return this.currentFrame !== this._prevFrameIndex
}

// 在 tick() 方法末尾更新
tick(deltaMs: number): { frameIndex: number; action: PetAction } {
  // ... 现有逻辑 ...
  this._prevFrameIndex = this.currentFrame
  return { frameIndex: this.currentFrame, action: this.currentAction }
}
```

- [ ] **Step 2: OffscreenLayer 新增动画帧感知**

在 `OffscreenLayer.ts` 中新增方法，让调用方可以按 action 类型判断是否需要重绘：

```typescript
/** 判断指定 action 是否为静态动画（不需要逐帧重绘） */
export function isStaticAction(action: PetAction): boolean {
  // sleep 只有微弱呼吸，可以低帧率缓存
  // 其他 action 都有帧间变化，需要重绘
  return action === 'sleep'
}
```

- [ ] **Step 3: 修复 usePetRenderer 渲染循环中的脏标记逻辑**

替换 `usePetRenderer.ts` L198-211 的脏标记判断：

```typescript
// 旧逻辑（有 bug）：
// if (currentMood !== prevMoodRef.current || currentAction !== prevActionRef.current) {
//   offscreen.markPetDirty()
// }

// 新逻辑：mood/action 变化 OR 动画帧变化 → 标记脏
const moodChanged = currentMood !== prevMoodRef.current
const actionChanged = currentAction !== prevActionRef.current
const frameChanged = renderer.hasFrameChanged

if (moodChanged || actionChanged) {
  offscreen.markPetDirty()
  prevMoodRef.current = currentMood
  prevActionRef.current = currentAction
}

// 非静态 action 的帧变化也需要重绘宠物层
if (frameChanged && !isStaticAction(currentAction)) {
  offscreen.markPetDirty()
}
```

同时，PixelRenderer/PetRenderer 的 `tick()` 返回值需要暴露 `hasFrameChanged`。在 `IRenderer` 接口中 tick 返回值增加可选字段：

```typescript
// IRenderer.ts - tick 返回类型
tick(deltaMs: number): { frameChanged?: boolean }
```

PixelRenderer 实现：
```typescript
tick(deltaMs: number): { frameIndex: number; action: PetAction; frameChanged: boolean } {
  if (!this.animController) return { frameIndex: 0, action: 'idle_stand', frameChanged: false }
  const result = this.animController.tick(deltaMs)
  return { ...result, frameChanged: this.animController.hasFrameChanged }
}
```

- [ ] **Step 4: 验证 tsc 编译通过**

Run: `cd /root/desktop-pet && npx tsc --noEmit`
Expected: 无错误输出

- [ ] **Step 5: Commit**

```bash
git add src/pet/AnimationController.ts src/pet/OffscreenLayer.ts src/pet/IRenderer.ts src/pet/PixelRenderer.ts src/pet/PetRenderer.ts src/hooks/usePetRenderer.ts
git commit -m "fix: 修复离屏缓存动画冻结 bug — 帧变化时也标记脏"
```

---

### Task 2: 补齐 IRenderer 接口一致性（PetRenderer 适配）

**问题：** PetRenderer.tick() 返回类型与 PixelRenderer 不一致，且 IRenderer.tick() 没有定义返回类型。Task 1 修改了 tick 返回值，PetRenderer 需要同步。

**Files:**
- Modify: `src/pet/IRenderer.ts`
- Modify: `src/pet/PetRenderer.ts`

**Interfaces:**
- Produces: `IRenderer.tick()` 标准化返回 `{ frameChanged: boolean }`

- [ ] **Step 1: 更新 IRenderer.tick 返回类型**

```typescript
// IRenderer.ts
export interface TickResult {
  frameChanged: boolean
}

export interface IRenderer {
  init(): Promise<void>
  reinit(theme: PetTheme): Promise<void>
  readonly isReady: boolean
  tick(deltaMs: number): TickResult
  draw(mood: PetMood, action: PetAction, centerX: number, centerY: number, timeMs: number, scale: number): void
}
```

- [ ] **Step 2: PetRenderer 实现 TickResult**

PetRenderer 是逐帧程序化绘制，每帧都变化，始终返回 `frameChanged: true`：

```typescript
tick(deltaMs: number): TickResult {
  this.frameTime += deltaMs
  return { frameChanged: true }
}
```

- [ ] **Step 3: PixelRenderer 使用 TickResult**

```typescript
tick(deltaMs: number): TickResult {
  if (!this.animController) return { frameChanged: false }
  this.animController.tick(deltaMs)
  return { frameChanged: this.animController.hasFrameChanged }
}
```

- [ ] **Step 4: usePetRenderer 适配 TickResult**

```typescript
// 渲染循环中
const tickResult = renderer.tick(delta)

if (moodChanged || actionChanged) {
  offscreen.markPetDirty()
  prevMoodRef.current = currentMood
  prevActionRef.current = currentAction
}

if (tickResult.frameChanged && !isStaticAction(currentAction)) {
  offscreen.markPetDirty()
}
```

- [ ] **Step 5: 验证编译**

Run: `cd /root/desktop-pet && npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add src/pet/IRenderer.ts src/pet/PixelRenderer.ts src/pet/PetRenderer.ts src/hooks/usePetRenderer.ts
git commit -m "refactor: IRenderer.tick() 标准化返回 TickResult，PetRenderer 适配"
```

---

### Task 3: 补齐 ProactiveEngine LLM 触发器

**问题：** `ProactiveEngine` 有 `canLLMFire`/`markLLMFire` 方法但从未被调用，设计文档中的"LLM 触发"功能未接入。

**Files:**
- Modify: `src/hooks/useChat.ts`
- Modify: `src/ai/ProactiveEngine.ts`

**Interfaces:**
- Consumes: `ProactiveEngine.canLLMFire`, `ProactiveEngine.markLLMFire`, `ChatEngine.chat()`
- Produces: 主动对话的 LLM 生成消息路径

- [ ] **Step 1: ProactiveEngine 新增 LLM 触发检查方法**

```typescript
// ProactiveEngine.ts 新增
/**
 * 检查是否应该触发 LLM 主动对话
 * 条件：冷却时间已过 + 宠物处于非交互状态
 */
shouldLLMFire(petState: PetState): boolean {
  if (!this.canLLMFire) return false
  if (petState.isDragging || petState.isChatOpen) return false
  if (petState.mood === 'sleeping') return false
  return true
}
```

- [ ] **Step 2: useChat 集成 LLM 主动对话**

在 `useChat.ts` 的主动对话定时检查 useEffect 中添加 LLM 路径：

```typescript
// 在已有的 setInterval 回调中，本地规则检查之后添加：
const proactiveEngine = proactiveRef.current
const chatEngine = chatEngineRef.current

// 本地规则优先
const message = proactiveEngine.check(petState, chatEngine.conversationMemory)
if (message) {
  s.addMessage({ id: crypto.randomUUID(), role: 'pet', content: message, timestamp: Date.now() })
  audioManager.play('greet')
} else if (proactiveEngine.shouldLLMFire(petState) && chatEngine.currentMode === 'cloud') {
  // LLM 主动对话（低频，30分钟冷却）
  proactiveEngine.markLLMFire()
  try {
    const llmMessage = await chatEngine.chat('请主动和主人说句话，可以聊聊你记得的事情或者提个有趣的话题。', s.mood)
    s.addMessage({ id: crypto.randomUUID(), role: 'pet', content: llmMessage, timestamp: Date.now() })
    audioManager.play('greet')
  } catch {
    // LLM 失败静默
  }
}
```

注意：需要将 `setInterval` 回调改为 `async` 以支持 `await chatEngine.chat()`。

- [ ] **Step 3: 验证编译**

Run: `cd /root/desktop-pet && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/ai/ProactiveEngine.ts src/hooks/useChat.ts
git commit -m "feat: 补齐 LLM 主动对话触发 — 30分钟冷却 + 云端生成话题"
```

---

### Task 4: 设置面板补齐 rendererType 选择

**问题：** `PetSettings` 有 `rendererType` 字段但设置面板无 UI 控制。

**Files:**
- Modify: `src/ui/SettingsPanel.tsx`

**Interfaces:**
- Consumes: `PetSettings.rendererType`, `handleChange()`
- Produces: 用户可切换 pixel/canvas 渲染器

- [ ] **Step 1: 在设置面板"宠物"section 末尾添加渲染器选择**

在 `SettingsPanel.tsx` 的"🐾 宠物"区块内，宠物名字输入框之后添加：

```tsx
<div className="settings-row">
  <label className="settings-label">渲染器</label>
  <select
    className="settings-select"
    value={settings.rendererType}
    onChange={(e) => handleChange({ rendererType: e.target.value as 'pixel' | 'canvas' })}
  >
    <option value="pixel">像素风（推荐）</option>
    <option value="canvas">程序化绘制</option>
  </select>
</div>
```

- [ ] **Step 2: handleSettingsChange 中处理渲染器切换**

在 `useChat.ts` 的 `handleSettingsChange` 回调中，当 `rendererType` 变化时需要重新创建渲染器：

```typescript
const handleSettingsChange = useCallback((settings: PetSettings) => {
  const s = store.getState()
  s.setCurrentModel(settings.model)
  audioManager.setEnabled(settings.soundEnabled)
  audioManager.setVolume(settings.soundVolume)
  chatEngineRef.current.updateConfig({ petName: settings.petName || '小光' })

  // 切换皮肤 → 重新生成精灵图
  const theme = getThemeBySkin((settings.skin || 'lumie') as SkinId)
  reinitTheme(theme)

  // 切换渲染器类型 → 需要通知 usePetRenderer 重建渲染器
  if (settings.rendererType) {
    reinitRenderer?.(settings.rendererType, theme, settings.skin)
  }
}, [store, reinitTheme])
```

这需要 `usePetRenderer` 暴露 `reinitRenderer` 方法。在 `usePetRenderer.ts` 中添加：

```typescript
const reinitRenderer = async (type: RendererType, theme: PetTheme, skinId: string = 'lumie') => {
  const renderer = createRenderer(type, offscreenRef.current!.petCtx, theme, skinId)
  await renderer.init()
  rendererRef.current = renderer
  offscreenRef.current?.markPetDirty()
}
```

- [ ] **Step 3: 更新 App.tsx 传递 reinitRenderer**

`useChat` 的参数列表中新增 `reinitRenderer`：

```typescript
const { chatEngine, handleSendMessage, handleQuickAction, handleSettingsChange } = useChat(
  reinitTheme, getParticleSystem, getStateMachine, PET_CENTER_X, PET_CENTER_Y,
)
// 新增 reinitRenderer 传递给 useChat
```

- [ ] **Step 4: 验证编译**

Run: `cd /root/desktop-pet && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add src/ui/SettingsPanel.tsx src/hooks/usePetRenderer.ts src/hooks/useChat.ts src/App.tsx
git commit -m "feat: 设置面板添加渲染器切换 + usePetRenderer 暴露 reinitRenderer"
```

---

### Task 5: petName 同步到 Zustand Store

**问题：** petName 散落在 ChatEngine config 和 localStorage 中，多个组件需要访问但无法通过 store 统一获取。

**Files:**
- Modify: `src/store/petStore.ts`
- Modify: `src/hooks/useChat.ts`

**Interfaces:**
- Produces: `usePetStore.petName` + `usePetStore.setPetName()`

- [ ] **Step 1: petStore 新增 petName**

```typescript
// petStore.ts interface 新增
petName: string
setPetName: (name: string) => void

// 初始状态
petName: '小光',

// Action
setPetName: (petName) => set({ petName }),
```

- [ ] **Step 2: useChat 初始化时从 settings 同步 petName**

```typescript
// useChat 初始化 useEffect 中
useEffect(() => {
  const saved = loadSettings()
  chatEngineRef.current.updateConfig({ ... })
  store.getState().setPetName(saved.petName || '小光')  // 新增
  // ...
}, [store])
```

- [ ] **Step 3: handleSettingsChange 同步 petName**

```typescript
const handleSettingsChange = useCallback((settings: PetSettings) => {
  store.getState().setPetName(settings.petName || '小光')  // 新增
  chatEngineRef.current.updateConfig({ petName: settings.petName || '小光' })
  // ...
}, [store, reinitTheme])
```

- [ ] **Step 4: 验证编译**

Run: `cd /root/desktop-pet && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add src/store/petStore.ts src/hooks/useChat.ts
git commit -m "feat: petName 同步到 Zustand store 统一管理"
```

---

### Task 6: 开机自启（tauri-plugin-autostart）

**问题：** `PetSettings.autoStart` 字段已预留但未实现。

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/main.ts` (如需前端绑定)
- Modify: `src/ui/SettingsPanel.tsx`
- Modify: `src/hooks/useChat.ts`

**Interfaces:**
- Consumes: `PetSettings.autoStart`, Tauri autostart plugin
- Produces: 用户可在设置中开关开机自启

- [ ] **Step 1: 添加 tauri-plugin-autostart 依赖**

在 `src-tauri/Cargo.toml` 的 `[dependencies]` 中添加：

```toml
tauri-plugin-autostart = "2"
```

- [ ] **Step 2: 注册插件到 Tauri 应用**

在 `src-tauri/src/lib.rs` 的 `run()` 函数中：

```rust
use tauri_plugin_autostart::MacosLauncher;

.tauri_plugin(tauri_plugin_autostart::init(
    MacosLauncher::LaunchAgent,
    Some(vec!["--minimized"]),
))
```

- [ ] **Step 3: 前端调用 autostart API**

创建 `src/utils/autostart.ts`：

```typescript
const isTauri = !!window.__TAURI_INTERNALS__

export async function setAutoStart(enabled: boolean): Promise<void> {
  if (!isTauri) return
  try {
    const autostart = await import('tauri-plugin-autostart-api')
    if (enabled) {
      await autostart.enable()
    } else {
      await autostart.disable()
    }
  } catch (err) {
    console.warn('[autostart] failed:', err)
  }
}

export async function isAutoStartEnabled(): Promise<boolean> {
  if (!isTauri) return false
  try {
    const autostart = await import('tauri-plugin-autostart-api')
    return await autostart.isEnabled()
  } catch {
    return false
  }
}
```

- [ ] **Step 4: 设置面板添加开机自启开关**

在 SettingsPanel.tsx 的"🐾 宠物"区块中添加：

```tsx
<div className="settings-row settings-row-center">
  <label className="settings-label">开机自启</label>
  <button
    className={`settings-toggle ${settings.autoStart ? 'on' : ''}`}
    onClick={async () => {
      const newVal = !settings.autoStart
      handleChange({ autoStart: newVal })
      const { setAutoStart } = await import('../utils/autostart')
      await setAutoStart(newVal)
    }}
  >
    <span className="settings-toggle-thumb" />
  </button>
</div>
```

- [ ] **Step 5: 验证 Rust 编译 + TypeScript 编译**

Run: `cd /root/desktop-pet/src-tauri && cargo check`
Run: `cd /root/desktop-pet && npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/src/lib.rs src/utils/autostart.ts src/ui/SettingsPanel.tsx
git commit -m "feat: 开机自启 — tauri-plugin-autostart + 设置面板开关"
```

---

## 任务依赖图

```
Task 1 (修复动画冻结) ─→ Task 2 (IRenderer 一致性)
                          ↓
                    Task 3 (LLM 主动对话) ← 独立
                    Task 4 (渲染器切换 UI) ← 依赖 Task 2 的 TickResult
                    Task 5 (petName store) ← 独立
                    Task 6 (开机自启) ← 独立
```

Task 1+2 是关键 bug 修复，必须先做。Task 3/5/6 互相独立可并行。Task 4 依赖 Task 2 的 TickResult 类型。

## 性能指标验证

完成 Task 1+2 后，验证设计文档中的性能目标：

| 指标 | 目标 | 验证方法 |
|------|------|----------|
| 空闲 CPU | <0.5% | 空闲状态观察 DevTools Performance |
| 睡觉 CPU | ≈0% | sleep action 观察帧率降至 6fps |
| 不可见 CPU | 0% | 最小化窗口后观察 |
| 交互 CPU | <5% | 拖拽时观察 |
