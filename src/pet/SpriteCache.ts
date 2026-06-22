import type { PetTheme, PetAction } from './types'
import type { SpriteSheet, SpriteAnimation } from './SpriteGenerator'
import { SpriteGenerator } from './SpriteGenerator'
import { FRAME_W, FRAME_H } from './spriteUtils'

// ============================================
// Sprite Sheet IndexedDB 缓存
// 首次生成后缓存，皮肤切换先查缓存
// 版本号控制失效
// ============================================

const DB_NAME = 'desktop-pet-sprites'
const STORE_NAME = 'sheets'
/** 版本号——帧数据变更时递增使缓存失效 */
const CACHE_VERSION = 1

interface CachedSheet {
  key: string
  version: number
  sheetCanvas: Blob
  frameRectsJson: string
  animationsJson: string
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function getCache(db: IDBDatabase, key: string): Promise<CachedSheet | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const req = store.get(key)
    req.onsuccess = () => resolve(req.result as CachedSheet | undefined)
    req.onerror = () => reject(req.error)
  })
}

function setCache(db: IDBDatabase, data: CachedSheet): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const req = store.put(data)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

/** 序列化 frameRects（Map 不能直接 JSON） */
function serializeFrameRects(
  frameRects: Map<PetAction, { col: number; row: number; w: number; h: number }[]>
): string {
  return JSON.stringify(Array.from(frameRects.entries()))
}

/** 反序列化 frameRects */
function deserializeFrameRects(
  json: string
): Map<PetAction, { col: number; row: number; w: number; h: number }[]> {
  return new Map(JSON.parse(json) as [PetAction, { col: number; row: number; w: number; h: number }[]][])
}

/** 序列化 animations（Map 含 FrameParams 数组） */
function serializeAnimations(animations: Map<PetAction, SpriteAnimation>): string {
  return JSON.stringify(Array.from(animations.entries()))
}

/** 反序列化 animations */
function deserializeAnimations(json: string): Map<PetAction, SpriteAnimation> {
  return new Map(JSON.parse(json) as [PetAction, SpriteAnimation][])
}

/** Canvas → Blob */
function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('canvasToBlob failed'))
    })
  })
}

/** Blob → HTMLCanvasElement */
async function blobToCanvas(blob: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()
  return canvas
}

/**
 * 生成 Sprite Sheet，优先使用 IndexedDB 缓存
 * @param skinId 皮肤ID，作为缓存 key
 * @param theme 主题配色
 */
export async function generateSheetWithCache(
  skinId: string,
  theme: PetTheme
): Promise<SpriteSheet> {
  const cacheKey = `sheet_${skinId}`

  try {
    const db = await openDB()
    const cached = await getCache(db, cacheKey)

    // 缓存命中且版本匹配
    if (cached && cached.version === CACHE_VERSION) {
      const canvas = await blobToCanvas(cached.sheetCanvas)
      const frameRects = deserializeFrameRects(cached.frameRectsJson)
      const animations = deserializeAnimations(cached.animationsJson)

      return {
        canvas,
        frameRects,
        animations,
        frameSize: { w: FRAME_W, h: FRAME_H },
      }
    }

    // 缓存未命中或版本不匹配，重新生成
    const sheet = new SpriteGenerator(theme).generate()

    // 异步写入缓存（不阻塞返回）
    canvasToBlob(sheet.canvas).then(async (blob) => {
      try {
        await setCache(db, {
          key: cacheKey,
          version: CACHE_VERSION,
          sheetCanvas: blob,
          frameRectsJson: serializeFrameRects(sheet.frameRects),
          animationsJson: serializeAnimations(sheet.animations),
        })
      } catch (err) {
        console.warn('[SpriteCache] write failed:', err)
      }
    })

    return sheet
  } catch (err) {
    // IndexedDB 不可用时直接生成
    console.warn('[SpriteCache] fallback to direct generation:', err)
    return new SpriteGenerator(theme).generate()
  }
}
