import type { PetTheme } from './types'
import type { IRenderer, RendererType } from './IRenderer'
import { PixelRenderer } from './PixelRenderer'
import { PetRenderer } from './PetRenderer'

// ============================================
// 渲染器工厂 — 根据类型创建 IRenderer 实例
// ============================================

export function createRenderer(
  type: RendererType,
  ctx: CanvasRenderingContext2D,
  theme: PetTheme,
  skinId: string = 'lumie'
): IRenderer {
  switch (type) {
    case 'pixel':
      return new PixelRenderer(ctx, theme, skinId)
    case 'canvas':
      return new PetRenderer(ctx, theme)
  }
}
