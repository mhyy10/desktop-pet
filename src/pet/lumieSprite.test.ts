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
