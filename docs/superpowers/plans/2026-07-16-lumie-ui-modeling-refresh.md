# 小光 UI 与宠物建模优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Upgrade the default Lumie sprite into a warm-light pixel fairy and expose existing tools through an accessible, controlled quick panel.

**Architecture:** Keep the procedural Canvas sprite pipeline and `PetTheme` API intact. Add a single UI state (`isQuickPanelOpen`) to the Zustand store, let `usePetInteraction` toggle it only on an unambiguous single click, and render the updated `QuickMenu` as an accessible controlled popover. Sprite geometry remains in `SpriteDrawer`; frame timing and poses remain in `SpriteAnimations`.

**Tech Stack:** React 19, TypeScript, Zustand 5, Canvas 2D, Vitest, Vite, Tauri 2.

## Global Constraints

- Retain the existing frame dimensions, `PetTheme` shape, IndexedDB cache flow, and all built-in/custom skin interfaces.
- Do not add a 3D engine, remote assets, new backend dependencies, or new app features.
- Keep single-click chat behavior; the quick panel must be opened by the visible launcher rather than replacing chat.
- Quick-panel Escape handling and every shortcut must be keyboard accessible.
- Preserve existing drag, double-click, long-press, reminder, chat, and full tool-panel behavior.

---

## File structure

- `src/pet/theme.ts` — default Lumie palette only.
- `src/pet/SpriteDrawer.ts` — Lumie-neutral rounded fairy silhouette and facial detail, parameterized only by `PetTheme`.
- `src/pet/SpriteAnimations.ts` — existing action timing and poses, with a calmer idle/breathe cycle.
- `src/pet/lumieSprite.test.ts` — deterministic pixel-level checks for the default sprite and animation table.
- `src/store/petStore.ts` — quick-panel state and state transitions.
- `src/store/petStore.test.ts` — state transitions without React or DOM.
- `src/ui/QuickMenu.tsx` / `src/ui/QuickMenu.css` — controlled, keyboard-accessible compact panel.
- `src/App.tsx` / `src/App.css` — launcher, controlled panel wiring, and shared visual tokens.

### Task 1: Lock down quick-panel store behavior

**Files:**
- Create: `src/store/petStore.test.ts`
- Modify: `src/store/petStore.ts`

**Interfaces:**
- Produces `isQuickPanelOpen: boolean`, `setQuickPanelOpen(open: boolean): void`, and `toggleQuickPanel(): void` on `PetStore`.
- `setChatOpen(false)` does not implicitly change `isQuickPanelOpen`; callers own the two overlays independently.

- [x] **Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { usePetStore } from './petStore'

describe('quick panel state', () => {
  beforeEach(() => usePetStore.setState({ isQuickPanelOpen: false }))

  it('toggles independently from chat visibility', () => {
    const store = usePetStore.getState()
    store.toggleQuickPanel()
    expect(usePetStore.getState()).toMatchObject({ isQuickPanelOpen: true, isChatOpen: false })
    usePetStore.getState().setChatOpen(true)
    usePetStore.getState().setQuickPanelOpen(false)
    expect(usePetStore.getState()).toMatchObject({ isQuickPanelOpen: false, isChatOpen: true })
  })
})
```

- [x] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/store/petStore.test.ts`

Expected: FAIL because `isQuickPanelOpen` and the actions are absent.

- [x] **Step 3: Add the smallest store surface**

```ts
// PetStore fields
isQuickPanelOpen: boolean
setQuickPanelOpen: (open: boolean) => void
toggleQuickPanel: () => void

// initial state and action implementations
isQuickPanelOpen: false,
setQuickPanelOpen: (isQuickPanelOpen) => set({ isQuickPanelOpen }),
toggleQuickPanel: () => set((state) => ({ isQuickPanelOpen: !state.isQuickPanelOpen })),
```

- [x] **Step 4: Run the focused test**

Run: `pnpm vitest run src/store/petStore.test.ts`

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/store/petStore.ts src/store/petStore.test.ts
git commit -m "feat: add controlled quick panel state"
```

### Task 2: Refresh the default Lumie sprite without changing the renderer contract

**Files:**
- Create: `src/pet/lumieSprite.test.ts`
- Modify: `src/pet/theme.ts`
- Modify: `src/pet/SpriteDrawer.ts`
- Modify: `src/pet/SpriteAnimations.ts`

**Interfaces:**
- Consumes the unchanged `PetTheme` and `FrameParams` interfaces.
- Produces an unchanged `SpriteDrawer.drawFrame(data, params): void` and `defineAnimations(): Map<PetAction, SpriteAnimation>`.

- [x] **Step 1: Write failing visual-contract tests**

```ts
import { describe, expect, it } from 'vitest'
import { SpriteDrawer } from './SpriteDrawer'
import { defineAnimations } from './SpriteAnimations'
import { defaultTheme } from './theme'

const idle = () => defineAnimations().get('idle_stand')!.frames[0]

describe('Lumie sprite contract', () => {
  it('draws a non-empty, opaque rounded sprite with facial highlight pixels', () => {
    const pixels = new Uint8ClampedArray(48 * 48 * 4)
    new SpriteDrawer(defaultTheme).drawFrame(pixels, idle())
    const opaque = Array.from({ length: 48 * 48 }, (_, i) => pixels[i * 4 + 3]).filter(Boolean)
    expect(opaque.length).toBeGreaterThan(160)
    expect(Array.from(pixels).some((value) => value === 255)).toBe(true)
  })

  it('keeps complete animation coverage and a six-frame idle loop', () => {
    const animations = defineAnimations()
    expect(animations.get('idle_stand')?.frames).toHaveLength(6)
    expect([...animations.keys()]).toEqual(expect.arrayContaining(['walk_left', 'sleep', 'wave', 'think', 'play']))
  })
})
```

- [x] **Step 2: Run the tests to verify baseline behavior and record any required threshold adjustment**

Run: `pnpm vitest run src/pet/lumieSprite.test.ts`

Expected: the coverage test initially fails if the intended new lower-body/core highlight pixels are not yet drawn; the animation coverage check passes.

- [x] **Step 3: Implement the revised fairy geometry**

In `SpriteDrawer`, replace the ear-only silhouette with a rounded head/body construction: a larger head ellipse, smaller tapered body ellipse, two small glow fins, eye white/highlight pixels, cheek pixels, and an inner core highlight. Keep `drawFrame` public signature and the arm/foot coordinates unchanged. Use existing `fillEllipse`, `fillRect`, `setPixel`, `blendColor`, and `darkenColor`; do not add Canvas or DOM dependencies.

Update the `lumie` definition in `theme.ts` exactly to:

```ts
primary: '#F6B86A', secondary: '#F28B82', warm: '#FFE1A6', cool: '#8E9AE8',
bodyColor: '#F6B86A', glowColor: '#FFE1A6', eyeColor: '#312B4A', cheekColor: '#F39A9C',
```

In `SpriteAnimations`, keep all action names and frame counts; make `idle_stand` alternate a one-pixel vertical bob and a single blink, while `idle_breathe` remains six frames with smooth 0→3→1 body offsets.

- [x] **Step 4: Run focused sprite tests**

Run: `pnpm vitest run src/pet/lumieSprite.test.ts`

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/pet/theme.ts src/pet/SpriteDrawer.ts src/pet/SpriteAnimations.ts src/pet/lumieSprite.test.ts
git commit -m "feat: refresh lumie fairy sprite"
```

### Task 3: Replace the hover-only rail with a controlled accessible quick panel

**Files:**
- Modify: `src/ui/QuickMenu.tsx`
- Modify: `src/ui/QuickMenu.css`
- Modify: `src/App.tsx`
- Modify: `src/App.css`

**Interfaces:**
- `QuickMenu` becomes `QuickMenu({ isOpen, onClose, onAction })`.
- `onAction(action: string)` remains unchanged so `useChat.handleQuickAction` remains the single tool dispatcher.

- [x] **Step 1: Write a TypeScript-first failing call-site change**

Change the `App.tsx` usage to the target contract before changing the component:

```tsx
<QuickMenu
  isOpen={isQuickPanelOpen}
  onClose={() => setQuickPanelOpen(false)}
  onAction={handleQuickAction}
/>
```

Run: `pnpm build`

Expected: FAIL because `QuickMenuProps` lacks `isOpen` and `onClose`, and `App` has not selected quick-panel store fields.

- [x] **Step 2: Implement the controlled component and Escape close**

Use this component boundary:

```tsx
interface QuickMenuProps {
  isOpen: boolean
  onClose: () => void
  onAction: (action: string) => void
}
```

Render nothing while closed. When open, render a `nav` with `aria-label="快捷工具"`, a labelled close `<button aria-label="关闭快捷工具">`, and existing menu buttons. Add an effect that calls `onClose()` for `KeyboardEvent.key === 'Escape'`, and remove its listener in the cleanup function. Each shortcut must call `onAction(item.id)` then `onClose()`.

In `App`, select `isQuickPanelOpen` and `setQuickPanelOpen`, add a visible button near the mood indicator that invokes `setQuickPanelOpen(true)`, and pass the new props. Do not alter `usePetInteraction` single-click chat behavior.

- [x] **Step 3: Implement the visual system**

Define shared CSS variables on `.pet-container`:

```css
--surface: rgba(29, 27, 52, 0.88);
--surface-border: rgba(255, 225, 166, 0.22);
--accent: #ffe1a6;
--accent-strong: #f6b86a;
--text: #f7f3ff;
--muted: rgba(247, 243, 255, 0.66);
```

Style the panel as a right-side 236px popover with 18px radius, blur, 12px internal spacing, a visible focus outline, and a two-column grid of tool buttons. The launcher is a compact “工具” pill; it must remain within the 300×350 container. Honor `prefers-reduced-motion` by disabling panel and chip transitions.

- [x] **Step 4: Build and run all unit tests**

Run: `pnpm test:run`

Expected: PASS.

Run: `pnpm build`

Expected: TypeScript completes and Vite produces `dist/`.

- [x] **Step 5: Commit**

```bash
git add src/App.tsx src/App.css src/ui/QuickMenu.tsx src/ui/QuickMenu.css
git commit -m "feat: add lumie quick tool panel"
```

### Task 4: Integrated validation and visual acceptance

**Files:**
- Modify only if a concrete defect is found in: `src/App.tsx`, `src/App.css`, `src/ui/QuickMenu.tsx`, `src/ui/QuickMenu.css`, `src/pet/SpriteDrawer.ts`, or `src/pet/SpriteAnimations.ts`.

**Interfaces:**
- Confirms the contracts from Tasks 1–3; adds no new public API.

- [x] **Step 1: Run the complete automated suite**

Run: `pnpm test:run`

Expected: PASS with the store and Lumie sprite tests included.

Run: `pnpm build`

Expected: PASS.

- [x] **Step 2: Manually verify all interactions**

Run: `pnpm dev`

Verify: launcher opens and close button/Escape closes; all six shortcuts open their existing full panels; chat opens on pet click; double click plays; long press reacts; dragging moves the window; reminder notification remains visible; changing to Eggy, Black Cat, Robot, and a custom skin retains the UI and does not corrupt the sprite.

- [x] **Step 3: Commit any validated defect correction**

```bash
git add src/App.tsx src/App.css src/ui/QuickMenu.tsx src/ui/QuickMenu.css src/pet/SpriteDrawer.ts src/pet/SpriteAnimations.ts
git commit -m "fix: polish lumie quick panel interactions"
```

Only create this commit if Step 2 required a source change.
