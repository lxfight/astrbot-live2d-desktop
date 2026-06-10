import type { ThemeRgb } from '@/utils/themePalette'

const MAX_TEXTURES = 4
/** 输入是 ≤256 边长的缩略图，隔像素采样足够 */
const SAMPLE_STRIDE = 2
/** 色相直方图桶数（每桶 15°） */
const HUE_BUCKET_COUNT = 24
/** HSV 明度下限：过暗像素（阴影、描边）不参与统计 */
const MIN_VALUE = 0.12
/** 饱和度下限：灰/白像素没有可用的色相信息 */
const MIN_SATURATION = 0.15
const MIN_ALPHA = 128

type HueBucket = {
  weight: number
  r: number
  g: number
  b: number
}

/** RGB → 色相桶下标（hue ∈ [0°, 360°) 均分 HUE_BUCKET_COUNT 桶） */
function hueBucketIndex(r: number, g: number, b: number, max: number, min: number): number {
  const delta = max - min
  let hue: number
  if (delta === 0) {
    hue = 0
  } else if (max === r) {
    hue = ((g - b) / delta + 6) % 6
  } else if (max === g) {
    hue = (b - r) / delta + 2
  } else {
    hue = (r - g) / delta + 4
  }
  return Math.min(HUE_BUCKET_COUNT - 1, Math.floor((hue / 6) * HUE_BUCKET_COUNT))
}

/**
 * 从 RGBA 像素数据统计主题色（纯函数，便于单元测试）。
 *
 * 色相直方图按「面积 × 饱和度」计票选出主色相，再对该色相邻域内的像素求
 * 饱和度加权平均色。面积主导让大面积主色（如蓝白模型的蓝）胜过高饱和的
 * 小色块（嘴内、腮红等红色系部件），饱和度权重则压制大面积的低饱和肤色。
 */
export function pickThemeColorFromPixels(pixelArrays: Uint8ClampedArray[]): ThemeRgb | null {
  const buckets: HueBucket[] = Array.from({ length: HUE_BUCKET_COUNT }, () => ({
    weight: 0,
    r: 0,
    g: 0,
    b: 0
  }))
  let totalWeight = 0

  for (const data of pixelArrays) {
    for (let i = 0; i + 3 < data.length; i += 4 * SAMPLE_STRIDE) {
      if (data[i + 3] < MIN_ALPHA) continue
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]

      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      if (max < MIN_VALUE * 255) continue
      const saturation = (max - min) / max
      if (saturation < MIN_SATURATION) continue

      const bucket = buckets[hueBucketIndex(r, g, b, max, min)]
      bucket.weight += saturation
      bucket.r += r * saturation
      bucket.g += g * saturation
      bucket.b += b * saturation
      totalWeight += saturation
    }
  }

  if (totalWeight <= 0) return null

  // 3 桶滑动窗口（45° 色相范围）计票选峰值，主色相横跨桶边界时合计面积仍能胜出
  let bestIndex = 0
  let bestScore = -1
  for (let i = 0; i < HUE_BUCKET_COUNT; i++) {
    const prev = buckets[(i + HUE_BUCKET_COUNT - 1) % HUE_BUCKET_COUNT]
    const next = buckets[(i + 1) % HUE_BUCKET_COUNT]
    const score = prev.weight + buckets[i].weight + next.weight
    if (score > bestScore) {
      bestScore = score
      bestIndex = i
    }
  }

  let weight = 0
  let r = 0
  let g = 0
  let b = 0
  for (const offset of [-1, 0, 1]) {
    const bucket = buckets[(bestIndex + offset + HUE_BUCKET_COUNT) % HUE_BUCKET_COUNT]
    weight += bucket.weight
    r += bucket.r
    g += bucket.g
    b += bucket.b
  }
  if (weight <= 0) return null

  return {
    r: Math.round(r / weight),
    g: Math.round(g / weight),
    b: Math.round(b / weight)
  }
}

/**
 * 从纹理缩略图 canvas 中提取主题色
 */
export function extractModelThemeColor(canvases: HTMLCanvasElement[]): ThemeRgb | null {
  const pixelArrays: Uint8ClampedArray[] = []

  for (const canvas of canvases.slice(0, MAX_TEXTURES)) {
    if (!canvas.width || !canvas.height) continue
    const ctx = canvas.getContext('2d')
    if (!ctx) continue

    try {
      pixelArrays.push(ctx.getImageData(0, 0, canvas.width, canvas.height).data)
    } catch {
      continue
    }
  }

  return pickThemeColorFromPixels(pixelArrays)
}
