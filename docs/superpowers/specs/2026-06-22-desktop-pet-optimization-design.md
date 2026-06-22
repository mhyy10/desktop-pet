# 桌面宠物优化设计

> 日期: 2026-06-22
> 阶段: 架构重构 → 渲染性能 → AI 增强
> 项目: desktop-pet (Tauri 2.0 + React + Canvas)

## 概述

三阶段优化，每阶段独立可交付：
1. **架构重构** — 统一渲染器接口、拆分大文件、模块边界清晰化
2. **渲染性能** — 离屏缓存 + 智能帧率 + Sprite Sheet 预生成缓存
3. **AI 增强** — 会话记忆 + 主动对话 + 情绪联动 + 宠物起名

---

## 阶段一：架构重构（中座重构）

### 1.1 统一渲染器接口

新增 `IRenderer` 接口，`PetRenderer` 和 `PixelRenderer` 各自实现：

```typescript
// src/pet/IRenderer.ts
export interface IRenderer {
  init(): Promise<void>
  reinit(theme: PetTheme): Promise<void>
  readonly isReady: boolean
  tick(deltaMs: number): void
  draw(mood: PetMood, action: PetAction, cx: number, cy: number, timeMs: number, scale: number): void
}
```

- `usePetRenderer` 通过工厂函数创建，不直接依赖具体渲染器类
- 默认使用 `PixelRenderer`，设置面板可切换
- 旧 `PetRenderer` 保留作为备用渲染器

### 1.2 渲染器工厂

```typescript
// src/pet/RendererFactory.ts
export function createRenderer(
  type: 'pixel' | 'canvas',
  ctx: CanvasRenderingContext2D,
  theme: PetTheme
): IRenderer {
  switch (type) {
    case 'pixel': return new PixelRenderer(ctx, theme)
    case 'canvas': return new PetRenderer(ctx, theme)
  }
}
```

### 1.3 SpriteGenerator 拆分

当前 652 行拆分为 4 个文件：

| 文件 | 职责 | 预估行数 |
|------|------|----------|
| `SpriteGenerator.ts` | 编排：组装 Sheet、总入口 | ~180 |
| `SpriteDrawer.ts` | 像素绘制：body/ears/face/arms/feet/glow | ~250 |
| `SpriteAnimations.ts` | 动画定义：10 种动作的帧参数数据 | ~150 |
| `spriteUtils.ts` | 底层工具：setPixel/fillRect/fillEllipse/flipHorizontal/颜色工具 | ~100 |

依赖方向：`SpriteGenerator` → `SpriteAnimations` + `SpriteDrawer` → `spriteUtils`

### 1.4 模块导出优化

- `pet/index.ts` 统一导出，隐藏内部实现细节
- `usePetRenderer` 只依赖 `IRenderer` 接口
- 新增 `RendererFactory` 导出

### 1.5 扩展点

- `IRenderer` 接口支持未来添加新渲染器（SVG、WebGL）
- `SpriteAnimations` 独立后，未来可从 JSON 加载动画定义（插件系统铺垫）
- 渲染器类型通过 `PetSettings.rendererType` 配置

### 1.6 设置面板变更

`PetSettings` 新增字段：
```typescript
rendererType: 'pixel' | 'canvas' // 默认 'pixel'
```

设置面板新增"渲染器"选择项。

---

## 阶段二：渲染性能优化（轻量优先）

### 2.1 离屏 Canvas 缓存

采用双 OffscreenCanvas 分层架构：

```
Layer 结构：
  OffscreenCanvas #1 — 宠物层（精灵图 + 发光效果）
  OffscreenCanvas #2 — 粒子层（粒子特效）
  主 Canvas — 合成输出
```

**脏标记策略：**
- 宠物层：仅在 action/mood 变化时标记脏，重绘后清除
- 粒子层：有活跃粒子时标记脏，粒子全部消亡后清除
- 主 Canvas：任一层脏时合成

**空闲时（idle + 无粒子）：** 宠物层只绘制一次，后续帧直接 `drawImage` 合成。

### 2.2 智能帧率控制

根据宠物当前状态动态调整帧率：

| 状态 | FPS | 条件 |
|------|-----|------|
| 用户交互中 | 60 | 拖拽/对话/菜单打开 |
| 宠物活跃动画 | 30 | bounce/walk/play/wave |
| 宠物空闲 | 12 | idle_stand/idle_breathe/think/eat |
| 宠物打盹/睡觉 | 6 | sleep |
| 窗口不可见 | 0 | 最小化/失焦 |

**实现：** 在渲染循环中根据 action 计算目标帧间隔，使用 `setTimeout` + `requestAnimationFrame` 混合调度：

```typescript
function getTargetFps(action: PetAction, isDragging: boolean, isVisible: boolean): number {
  if (!isVisible) return 0
  if (isDragging) return 60
  if (['bounce', 'walk_left', 'walk_right', 'play', 'wave'].includes(action)) return 30
  if (['idle_stand', 'idle_breathe', 'think', 'eat'].includes(action)) return 12
  if (action === 'sleep') return 6
  return 12
}
```

**可见性检测：**
- `document.visibilitychange` 事件（Web 标准）
- Tauri 窗口焦点事件（`appWindow.onFocusChanged`）
- 任一不可见 → FPS = 0，暂停渲染循环

### 2.3 Sprite Sheet 预生成缓存

**缓存策略：**
- 首次生成后存入 `IndexedDB`（key = `spritesheet_${skinId}_${version}`）
- 版本号硬编码在代码中，帧数据变更时递增使缓存失效
- 皮肤切换时先查缓存，命中直接用，未命中再生成

### 2.4 性能指标目标

| 指标 | 优化前 | 目标 |
|------|--------|------|
| 空闲 CPU 占用 | ~3-5% (60fps) | <0.5% (12fps) |
| 交互 CPU 占用 | ~5-8% | <5% |
| 内存 | ~25-35MB | <30MB |
| 不可见 CPU | ~3-5% | 0% |

---

## 阶段三：AI 增强

### 3.1 会话记忆系统

**双层记忆架构：**

```
ConversationMemory
  ├─ ShortTermMemory — 最近 20 轮对话原文（内存）
  └─ LongTermMemory — 历史摘要 + 关键事实（IndexedDB）
```

- **ShortTermMemory**：最近 20 轮对话原文，随 ChatEngine 实例存在
- **LongTermMemory**：
  - 每 5 轮对话自动让 LLM 生成摘要（或本地关键词提取降级方案）
  - 提取关键事实：用户偏好、宠物名字、重要事件
  - 存储到 IndexedDB，跨会话持久化

**ChatEngine 修改：** `chat()` 方法自动注入记忆上下文：

```
System Prompt:
你是桌面宠物 {petName}，性格是 {personality}。

[历史摘要] {longTermSummary}

[当前对话] {shortTermMessages}
```

### 3.2 主动对话系统

新增 `ProactiveEngine` 类：

```typescript
// src/ai/ProactiveEngine.ts
interface ProactiveTrigger {
  id: string
  check(petState: PetState, memory: ConversationMemory): boolean
  generateMessage(petState: PetState, memory: ConversationMemory): string | Promise<string>
  cooldown: number // 最小触发间隔（ms）
}

class ProactiveEngine {
  addTrigger(trigger: ProactiveTrigger): void
  check(petState: PetState, memory: ConversationMemory): string | null
}
```

**内置触发规则：**

| 触发类型 | 条件 | 示例 | 调 API? |
|----------|------|------|---------|
| 时间触发 | 无交互超过 5 分钟 | "主人，你还在吗？" | 否 |
| 事件触发 | 心情变化（尤其变 sad） | "我有点不开心..." | 否 |
| 环境触发 | 时间段变化（早/中/晚/夜） | "该休息了！" | 否 |
| LLM 触发 | 定期（每 30 分钟最多 1 次） | 基于记忆的个性化话题 | 是 |

- 主动对话通过 ChatBubble 展示，不打开侧边栏
- LLM 触发有严格频率限制，离线时自动降级到本地规则

### 3.3 情绪联动

**双向绑定：**

```
AI 对话内容 ──→ MoodAnalyzer ──→ 影响宠物心情/动作
                    ↑
宠物心情变化 ──→ 注入对话上下文 ──→ 影响 AI 回复风格
```

**MoodAnalyzer 实现（纯本地，不调 API）：**
- 正面关键词（开心/好的/太棒了/不错）→ happy/excited
- 负面关键词（难过/不行/糟糕/烦）→ sad/angry
- 疑问关键词（为什么/怎么回事/什么）→ thinking
- 无明确情感 → 不改变当前心情

**对话侧：** 注入当前心情到 System Prompt：
```
你现在的心情是 {mood}，请在回复中体现这个心情。
```

**状态机侧：** `setMood()` 触发时通知 ProactiveEngine 判断是否需要主动说话。

### 3.4 宠物起名

**PetSettings 变更：**
```typescript
petName: string // 默认值按皮肤：小光/煎蛋仔/黑猫/机器人
```

**名字用途：**
- AI 对话的 System Prompt
- 主动对话中的自称
- 对话气泡中的署名
- 托盘菜单标题

**设置面板：** 新增"宠物名字"输入框，默认值跟随皮肤选择。

### 3.5 模块依赖关系

```
ChatEngine ←── ConversationMemory ←── IndexedDB
    ↑                ↑
    │                │
ProactiveEngine ────┘
    ↑
    │
MoodAnalyzer ←── StateMachine
    ↑
    │
useChat hook ── usePetRenderer (通过 store)
```

### 3.6 离线降级策略

- 无 API Key 或网络不可用 → 纯本地模式
  - 会话记忆：仅 ShortTermMemory，不生成摘要
  - 主动对话：仅本地规则触发，预设文案池
  - 情绪联动：MoodAnalyzer 正常工作（纯本地）
  - 宠物起名：正常工作（纯本地）

---

## 新增文件清单

### 阶段一
- `src/pet/IRenderer.ts` — 渲染器接口
- `src/pet/RendererFactory.ts` — 渲染器工厂
- `src/pet/SpriteDrawer.ts` — 精灵像素绘制（从 SpriteGenerator 拆出）
- `src/pet/SpriteAnimations.ts` — 动画帧定义（从 SpriteGenerator 拆出）
- `src/pet/spriteUtils.ts` — 像素绘制工具（从 SpriteGenerator 拆出）

### 阶段二
- `src/pet/OffscreenLayer.ts` — 离屏 Canvas 分层管理
- `src/pet/FrameRateController.ts` — 智能帧率控制

### 阶段三
- `src/ai/ConversationMemory.ts` — 会话记忆（短期+长期）
- `src/ai/ProactiveEngine.ts` — 主动对话引擎
- `src/ai/MoodAnalyzer.ts` — 文本情感分析

## 修改文件清单

### 阶段一
- `src/pet/PixelRenderer.ts` — 实现 IRenderer 接口
- `src/pet/PetRenderer.ts` — 实现 IRenderer 接口
- `src/pet/SpriteGenerator.ts` — 瘦身为编排层
- `src/pet/index.ts` — 新增 IRenderer/RendererFactory 导出
- `src/hooks/usePetRenderer.ts` — 使用工厂创建渲染器
- `src/ui/SettingsPanel.tsx` — 新增渲染器选择
- `src/utils/storage.ts` — PetSettings 新增 rendererType
- `src/store/petStore.ts` — 如需新增 rendererType 状态

### 阶段二
- `src/hooks/usePetRenderer.ts` — 集成离屏缓存 + 智能帧率
- `src/pet/PixelRenderer.ts` — 支持离屏缓存脏标记
- `src/pet/Particles.ts` — 支持离屏绘制

### 阶段三
- `src/ai/ChatEngine.ts` — 集成记忆系统 + 情绪联动
- `src/hooks/useChat.ts` — 集成 ProactiveEngine + MoodAnalyzer
- `src/hooks/useReminder.ts` — 可能与 ProactiveEngine 协调
- `src/ui/SettingsPanel.tsx` — 新增宠物名字输入
- `src/utils/storage.ts` — PetSettings 新增 petName
- `src/store/petStore.ts` — 新增 petName 状态
- `src-tauri/src/lib.rs` — 托盘菜单标题动态化
