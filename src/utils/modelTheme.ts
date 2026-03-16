import type { ThemeRgb } from '@/utils/themePalette'

type Bucket = {
  score: number
  red: number
  green: number
  blue: number
  saturation: number
  lightness: number
  samples: number
}

type HslColor = {
  h: number
  s: number
  l: number
}

const MAX_TEXTURES = 6
const MAX_SAMPLE_SIDE = 96
const PIXEL_STRIDE = 16
const MIN_ALPHA = 56

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function rgbToHsl(rgb: ThemeRgb): HslColor {
  const r = rgb.r / 255
  const g = rgb.g / 255
  const b = rgb.b / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  const lightness = (max + min) / 2

  if (delta === 0) {
    return { h: 0, s: 0, l: lightness }
  }

  const saturation = delta / (1 - Math.abs(2 * lightness - 1))
  let hue = 0

  switch (max) {
    case r:
      hue = ((g - b) / delta) % 6
      break
    case g:
      hue = (b - r) / delta + 2
      break
    default:
      hue = (r - g) / delta + 4
      break
  }

  return {
    h: (hue * 60 + 360) % 360,
    s: saturation,
    l: lightness,
  }
}

function buildBucketKey(hsl: HslColor): string {
  if (hsl.s < 0.12) {
    return `neutral:${Math.round(hsl.l * 6)}`
  }

  return [
    Math.round(hsl.h / 18) * 18,
    Math.round(hsl.s * 6),
    Math.round(hsl.l * 5),
  ].join(':')
}

function pushBucket(
  buckets: Map<string, Bucket>,
  key: string,
  rgb: ThemeRgb,
  hsl: HslColor,
  weight: number,
) {
  if (weight <= 0) {
    return
  }

  const bucket = buckets.get(key) || {
    score: 0,
    red: 0,
    green: 0,
    blue: 0,
    saturation: 0,
    lightness: 0,
    samples: 0,
  }

  bucket.score += weight
  bucket.red += rgb.r * weight
  bucket.green += rgb.g * weight
  bucket.blue += rgb.b * weight
  bucket.saturation += hsl.s
  bucket.lightness += hsl.l
  bucket.samples += 1
  buckets.set(key, bucket)
}

function resolveBucketColor(bucket: Bucket): ThemeRgb {
  return {
    r: Math.round(bucket.red / bucket.score),
    g: Math.round(bucket.green / bucket.score),
    b: Math.round(bucket.blue / bucket.score),
  }
}

function pickBestBucket(buckets: Map<string, Bucket>): ThemeRgb | null {
  let winner: Bucket | null = null
  let winnerScore = -1

  for (const bucket of buckets.values()) {
    if (bucket.score <= 0 || bucket.samples === 0) {
      continue
    }

    const avgSaturation = bucket.saturation / bucket.samples
    const avgLightness = bucket.lightness / bucket.samples
    const chromaBoost = 1 + avgSaturation * 0.85
    const tonePenalty = avgLightness < 0.12 || avgLightness > 0.9 ? 0.72 : 1
    const sampleBoost = 1 + Math.min(bucket.samples / 36, 0.25)
    const score = bucket.score * chromaBoost * tonePenalty * sampleBoost

    if (score > winnerScore) {
      winner = bucket
      winnerScore = score
    }
  }

  return winner ? resolveBucketColor(winner) : null
}

function createSampleCanvas(image: HTMLImageElement): [HTMLCanvasElement, CanvasRenderingContext2D] | null {
  if (typeof document === 'undefined' || !image.naturalWidth || !image.naturalHeight) {
    return null
  }

  const scale = Math.min(1, MAX_SAMPLE_SIDE / Math.max(image.naturalWidth, image.naturalHeight))
  const width = Math.max(1, Math.round(image.naturalWidth * scale))
  const height = Math.max(1, Math.round(image.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  if (!context) {
    return null
  }

  canvas.width = width
  canvas.height = height
  context.clearRect(0, 0, width, height)
  context.drawImage(image, 0, 0, width, height)

  return [canvas, context]
}

function sampleTexture(
  image: HTMLImageElement,
  accentBuckets: Map<string, Bucket>,
  overallBuckets: Map<string, Bucket>,
) {
  const sampled = createSampleCanvas(image)
  if (!sampled) {
    return
  }

  const [canvas, context] = sampled

  let pixels: Uint8ClampedArray
  try {
    pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
  } catch (error) {
    console.warn('[Theme] 读取模型纹理像素失败:', error)
    return
  }

  for (let index = 0; index < pixels.length; index += PIXEL_STRIDE) {
    const alpha = pixels[index + 3]
    if (alpha < MIN_ALPHA) {
      continue
    }

    const rgb = {
      r: pixels[index],
      g: pixels[index + 1],
      b: pixels[index + 2],
    }
    const hsl = rgbToHsl(rgb)
    const alphaWeight = alpha / 255
    const saturationScore = clamp((hsl.s - 0.08) / 0.92, 0, 1)
    const lightnessScore = 1 - Math.min(1, Math.abs(hsl.l - 0.52) / 0.52)
    const baseWeight = alphaWeight * (0.4 + saturationScore * 0.9 + lightnessScore * 0.55)
    const key = buildBucketKey(hsl)

    pushBucket(overallBuckets, key, rgb, hsl, baseWeight)

    if (hsl.s >= 0.16 && hsl.l >= 0.16 && hsl.l <= 0.84) {
      const accentWeight = baseWeight * (0.8 + saturationScore * 1.25)
      pushBucket(accentBuckets, key, rgb, hsl, accentWeight)
    }
  }
}

export function extractModelThemeColor(images: HTMLImageElement[]): ThemeRgb | null {
  const accentBuckets = new Map<string, Bucket>()
  const overallBuckets = new Map<string, Bucket>()

  for (const image of images.slice(0, MAX_TEXTURES)) {
    sampleTexture(image, accentBuckets, overallBuckets)
  }

  return pickBestBucket(accentBuckets) || pickBestBucket(overallBuckets)
}
