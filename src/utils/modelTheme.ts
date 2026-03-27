import { Vibrant } from 'node-vibrant/browser'
import type { ThemeRgb } from '@/utils/themePalette'

const MAX_TEXTURES = 4
const CANVAS_SIZE = 320

/**
 * 将多个纹理 canvas 合并到白底 canvas 上（消除透明度对颜色提取的干扰）
 */
function flattenToWhiteBg(sources: HTMLCanvasElement[]): HTMLCanvasElement | null {
  if (sources.length === 0) return null

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const cols = Math.ceil(Math.sqrt(sources.length))
  const rows = Math.ceil(sources.length / cols)
  const cellSize = Math.floor(CANVAS_SIZE / Math.max(cols, rows))
  canvas.width = cellSize * cols
  canvas.height = cellSize * rows

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.globalCompositeOperation = 'source-over'

  for (let i = 0; i < sources.length; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    ctx.drawImage(sources[i], col * cellSize, row * cellSize, cellSize, cellSize)
  }

  return canvas
}

/**
 * 从像素数据中采样有颜色的像素，分桶统计
 */
function sampleColors(canvas: HTMLCanvasElement): { r: number; g: number; b: number; count: number }[] {
  const ctx = canvas.getContext('2d')
  if (!ctx) return []

  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
  const buckets = new Map<string, { r: number; g: number; b: number; count: number }>()

  for (let i = 0; i < data.length; i += 16) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3]
    if (a < 128) continue

    const lightness = (r + g + b) / 765
    if (lightness > 0.92 || lightness < 0.08) continue

    const max = Math.max(r, g, b), min = Math.min(r, g, b)
    const saturation = max === 0 ? 0 : (max - min) / max
    if (saturation < 0.15) continue

    const key = `${Math.round(r / 16)}:${Math.round(g / 16)}:${Math.round(b / 16)}`
    const bucket = buckets.get(key) || { r: 0, g: 0, b: 0, count: 0 }
    bucket.r += r; bucket.g += g; bucket.b += b; bucket.count++
    buckets.set(key, bucket)
  }

  return Array.from(buckets.values())
}

/**
 * 从像素桶中选出最佳主题色
 */
function pickFromBuckets(buckets: { r: number; g: number; b: number; count: number }[]): ThemeRgb | null {
  if (buckets.length === 0) return null

  const top = buckets.sort((a, b) => b.count - a.count).slice(0, 5)

  let best: ThemeRgb | null = null
  let bestScore = -1

  for (const bucket of top) {
    const r = Math.round(bucket.r / bucket.count)
    const g = Math.round(bucket.g / bucket.count)
    const b = Math.round(bucket.b / bucket.count)

    const max = Math.max(r, g, b), min = Math.min(r, g, b)
    const saturation = max === 0 ? 0 : (max - min) / max
    const lightness = (r + g + b) / 765

    const lightnessScore = 1 - Math.abs(lightness - 0.45) * 2.2
    const score = saturation * 0.65 + lightnessScore * 0.35 + (bucket.count / top[0].count) * 0.1

    if (score > bestScore) {
      best = { r, g, b }
      bestScore = score
    }
  }

  return best
}

/**
 * 使用 node-vibrant 提取主题色
 */
async function extractVibrant(canvas: HTMLCanvasElement): Promise<ThemeRgb | null> {
  try {
    const dataUrl = canvas.toDataURL('image/png')
    const palette = await Vibrant.from(dataUrl, { quality: 1, colorCount: 64 }).getPalette()

    const order = ['Vibrant', 'DarkVibrant', 'LightVibrant', 'Muted', 'DarkMuted', 'LightMuted']
    for (const name of order) {
      const swatch = (palette as any)[name]
      if (!swatch) continue
      const [r, g, b] = swatch.rgb
      if (r + g + b < 30 || r + g + b > 720) continue
      return { r: Math.round(r), g: Math.round(g), b: Math.round(b) }
    }
    return null
  } catch {
    return null
  }
}

/**
 * 从 Live2D 模型纹理中提取主题色
 * 双策略：Vibrant 语义化 + 像素采样投票
 */
export async function extractModelThemeColor(canvases: HTMLCanvasElement[]): Promise<ThemeRgb | null> {
  const sources = canvases.slice(0, MAX_TEXTURES)
  if (sources.length === 0) return null

  const flat = flattenToWhiteBg(sources)
  if (!flat) return null

  const [vibrantColor, sampledColor] = await Promise.all([
    extractVibrant(flat),
    Promise.resolve(pickFromBuckets(sampleColors(flat))),
  ])

  // 两者都有，取饱和度更高的
  if (vibrantColor && sampledColor) {
    const vSat = (() => { const m = Math.max(vibrantColor.r, vibrantColor.g, vibrantColor.b), n = Math.min(vibrantColor.r, vibrantColor.g, vibrantColor.b); return m === 0 ? 0 : (m - n) / m })()
    const sSat = (() => { const m = Math.max(sampledColor.r, sampledColor.g, sampledColor.b), n = Math.min(sampledColor.r, sampledColor.g, sampledColor.b); return m === 0 ? 0 : (m - n) / m })()
    return vSat >= sSat ? vibrantColor : sampledColor
  }

  return vibrantColor || sampledColor
}
