import type { ThemeRgb } from '@/utils/themePalette'

const MAX_TEXTURES = 4
const SAMPLE_STRIDE = 8  // 每 8 个像素采样一次（性能）

/**
 * 从 canvas 中采样像素并分析主题色
 * 直接读取 WebGL readPixels 产生的像素数据，不依赖外部库
 */
export function extractModelThemeColor(canvases: HTMLCanvasElement[]): ThemeRgb | null {
  const buckets = new Map<string, { r: number; g: number; b: number; count: number }>()

  for (const canvas of canvases.slice(0, MAX_TEXTURES)) {
    const ctx = canvas.getContext('2d')
    if (!ctx) continue

    let data: Uint8ClampedArray
    try {
      data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    } catch {
      continue
    }

    for (let i = 0; i < data.length; i += 4 * SAMPLE_STRIDE) {
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3]
      if (a < 100) continue

      // 跳过接近纯黑/纯白
      const lightness = (r * 0.299 + g * 0.587 + b * 0.114) / 255
      if (lightness > 0.93 || lightness < 0.07) continue

      // 跳过低饱和度（灰色系）
      const max = Math.max(r, g, b), min = Math.min(r, g, b)
      const saturation = max === 0 ? 0 : (max - min) / max
      if (saturation < 0.12) continue

      // 分桶（RGB 量化到 12 级，约 216 桶）
      const key = `${Math.round(r / 22)}:${Math.round(g / 22)}:${Math.round(b / 22)}`
      const bucket = buckets.get(key) || { r: 0, g: 0, b: 0, count: 0 }
      bucket.r += r; bucket.g += g; bucket.b += b; bucket.count++
      buckets.set(key, bucket)
    }
  }

  if (buckets.size === 0) return null

  // 按数量排序，取前 8 个桶
  const top = Array.from(buckets.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  let best: ThemeRgb | null = null
  let bestScore = -1

  for (const bucket of top) {
    const r = Math.round(bucket.r / bucket.count)
    const g = Math.round(bucket.g / bucket.count)
    const b = Math.round(bucket.b / bucket.count)

    const max = Math.max(r, g, b), min = Math.min(r, g, b)
    const saturation = max === 0 ? 0 : (max - min) / max
    const lightness = (r * 0.299 + g * 0.587 + b * 0.114) / 255

    // 评分：饱和度权重最高，亮度偏好中间调，频率作为次要因素
    const lightnessTarget = 1 - Math.abs(lightness - 0.42) * 2.4
    const frequencyRatio = bucket.count / top[0].count
    const score = saturation * 0.55
      + Math.max(0, lightnessTarget) * 0.30
      + frequencyRatio * 0.15

    if (score > bestScore) {
      best = { r, g, b }
      bestScore = score
    }
  }

  return best
}
