import { Vibrant } from 'node-vibrant/browser'
import type { ThemeRgb } from '@/utils/themePalette'

const MAX_TEXTURES = 4
const TEXTURE_SAMPLE_SIZE = 512
const MIN_ALPHA = 56

/**
 * 从 WebGL 纹理创建离屏 canvas 用于颜色提取
 */
function createTextureCanvas(image: HTMLImageElement): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const scale = Math.min(1, TEXTURE_SAMPLE_SIZE / Math.max(image.naturalWidth || 256, image.naturalHeight || 256))
  canvas.width = Math.max(1, Math.round((image.naturalWidth || 256) * scale))
  canvas.height = Math.max(1, Math.round((image.naturalHeight || 256) * scale))

  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas
}

/**
 * 使用 node-vibrant 从单个纹理提取 Vibrant 颜色
 */
async function extractVibrantFromCanvas(canvas: HTMLCanvasElement): Promise<ThemeRgb | null> {
  try {
    const palette = await Vibrant.from(canvas)
      .maxColorCount(64)
      .quality(1)
      .getPalette()

    // 优先级：Vibrant > DarkVibrant > LightVibrant > Muted
    const swatchOrder = ['Vibrant', 'DarkVibrant', 'LightVibrant', 'Muted', 'DarkMuted', 'LightMuted']

    for (const name of swatchOrder) {
      const swatch = (palette as any)[name]
      if (swatch) {
        const [r, g, b] = swatch.rgb
        // 跳过过暗或过亮的颜色
        if (r + g + b < 30 || r + g + b > 720) continue
        return { r: Math.round(r), g: Math.round(g), b: Math.round(b) }
      }
    }
    return null
  } catch {
    return null
  }
}

/**
 * 合并多个纹理的颜色结果，取饱和度最高的
 */
function pickBestColor(colors: ThemeRgb[]): ThemeRgb | null {
  if (colors.length === 0) return null

  let best = colors[0]
  let bestScore = -1

  for (const color of colors) {
    const { r, g, b } = color
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const saturation = max === 0 ? 0 : (max - min) / max
    const lightness = (max + min) / 510

    // 偏好中等亮度、高饱和度的颜色
    const lightnessScore = 1 - Math.abs(lightness - 0.5) * 2
    const score = saturation * 0.7 + lightnessScore * 0.3

    if (score > bestScore) {
      best = color
      bestScore = score
    }
  }

  return best
}

/**
 * 从 Live2D 模型纹理中提取主题色
 */
export async function extractModelThemeColor(images: HTMLImageElement[]): Promise<ThemeRgb | null> {
  const canvases: HTMLCanvasElement[] = []

  for (const image of images.slice(0, MAX_TEXTURES)) {
    const canvas = createTextureCanvas(image)
    if (canvas) {
      canvases.push(canvas)
    }
  }

  if (canvases.length === 0) return null

  // 并行提取每个纹理的 Vibrant 颜色
  const colorPromises = canvases.map(extractVibrantFromCanvas)
  const results = await Promise.all(colorPromises)
  const validColors = results.filter((c): c is ThemeRgb => c !== null)

  return pickBestColor(validColors)
}

/**
 * 同步版本：从 canvas 直接提取（用于不支持 async 的场景）
 */
export function extractModelThemeColorSync(images: HTMLImageElement[]): ThemeRgb | null {
  // 同步版本退化为平均色采样
  let totalR = 0, totalG = 0, totalB = 0, count = 0

  for (const image of images.slice(0, MAX_TEXTURES)) {
    const canvas = createTextureCanvas(image)
    if (!canvas) continue

    const ctx = canvas.getContext('2d')
    if (!ctx) continue

    try {
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
      for (let i = 0; i < data.length; i += 32) {
        if (data[i + 3] < MIN_ALPHA) continue
        totalR += data[i]
        totalG += data[i + 1]
        totalB += data[i + 2]
        count++
      }
    } catch {
      continue
    }
  }

  if (count === 0) return null
  return {
    r: Math.round(totalR / count),
    g: Math.round(totalG / count),
    b: Math.round(totalB / count),
  }
}
