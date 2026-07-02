import { useEffect, useRef, useState } from 'react'
import type { PetTheme, PetAction } from '../pet/types'
import { SpriteGenerator } from '../pet/SpriteGenerator'
import { AnimationController } from '../pet/AnimationController'
import type { SpriteSheet } from '../pet/SpriteGenerator'
import './SkinPreview.css'

// ============================================
// 皮肤实时预览
// 输入 theme，同步生成 SpriteSheet（不走 IndexedDB 缓存），
// rAF 循环按帧绘制 idle/walk/wave 动画
// ============================================

/** 预览循环播放的动作序列 */
const PREVIEW_ACTIONS: PetAction[] = ['idle_stand', 'walk_right', 'wave']
/** 每个动作展示时长 (ms) */
const ACTION_DURATION = 2400
/** 渲染倍率：48px → size */
const RENDER_SCALE = 3

interface SkinPreviewProps {
  theme: PetTheme
  /** 预览区像素尺寸（默认 144） */
  size?: number
}

export function SkinPreview({ theme, size = 144 }: SkinPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sheetRef = useRef<SpriteSheet | null>(null)
  const animRef = useRef<AnimationController | null>(null)
  const [error, setError] = useState<string | null>(null)

  // theme 变化时重新生成 sheet
  useEffect(() => {
    try {
      const sheet = new SpriteGenerator(theme).generate()
      sheetRef.current = sheet
      animRef.current = new AnimationController(sheet.animations)
      setError(null)
    } catch (err) {
      setError('预览生成失败：' + (err instanceof Error ? err.message : String(err)))
    }
  }, [theme])

  // rAF 渲染循环
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.imageSmoothingEnabled = false
    let raf = 0
    let lastTs = performance.now()
    let actionStartTs = lastTs
    let actionIdx = 0

    const render = (ts: number) => {
      const delta = ts - lastTs
      lastTs = ts

      const sheet = sheetRef.current
      const anim = animRef.current
      if (sheet && anim) {
        // 切换预览动作
        if (ts - actionStartTs >= ACTION_DURATION) {
          actionIdx = (actionIdx + 1) % PREVIEW_ACTIONS.length
          actionStartTs = ts
        }
        const action = PREVIEW_ACTIONS[actionIdx]
        anim.play(action)
        anim.tick(delta)

        const frameIndex = anim.currentFrame
        const rects = sheet.frameRects.get(action)
        const rect = rects?.[frameIndex]
        if (rect) {
          const { w, h } = sheet.frameSize
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          ctx.save()
          ctx.translate(canvas.width / 2, canvas.height / 2)
          ctx.scale(RENDER_SCALE, RENDER_SCALE)
          ctx.imageSmoothingEnabled = false
          const sx = rect.col * w
          const sy = rect.row * h
          ctx.drawImage(sheet.canvas, sx, sy, w, h, -w / 2, -h / 2 + 5, w, h)
          ctx.restore()
        }
      }
      raf = requestAnimationFrame(render)
    }
    raf = requestAnimationFrame(render)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="skin-preview" style={{ width: size, height: size }}>
      {error ? (
        <div className="skin-preview-error">{error}</div>
      ) : (
        <canvas
          ref={canvasRef}
          width={size}
          height={size}
          style={{ width: size, height: size, imageRendering: 'pixelated' }}
        />
      )}
    </div>
  )
}
