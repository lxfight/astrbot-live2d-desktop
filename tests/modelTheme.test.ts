import { describe, expect, it } from 'vitest'

import { extractModelThemeColor, pickThemeColorFromPixels } from '../src/utils/modelTheme'

/** 按色块铺像素：每个色块连续 count 个 RGBA 像素 */
function makePixels(
  entries: Array<{ rgba: [number, number, number, number]; count: number }>
): Uint8ClampedArray {
  const total = entries.reduce((sum, entry) => sum + entry.count, 0)
  const data = new Uint8ClampedArray(total * 4)
  let offset = 0
  for (const entry of entries) {
    for (let i = 0; i < entry.count; i++) {
      data.set(entry.rgba, offset)
      offset += 4
    }
  }
  return data
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  let rgb: [number, number, number]
  if (h < 60) rgb = [c, x, 0]
  else if (h < 120) rgb = [x, c, 0]
  else if (h < 180) rgb = [0, c, x]
  else if (h < 240) rgb = [0, x, c]
  else if (h < 300) rgb = [x, 0, c]
  else rgb = [c, 0, x]
  return [
    Math.round((rgb[0] + m) * 255),
    Math.round((rgb[1] + m) * 255),
    Math.round((rgb[2] + m) * 255)
  ]
}

describe('pickThemeColorFromPixels', () => {
  it('picks blue for a blue-and-white model despite small saturated red parts', () => {
    // 模拟蓝白模型纹理：大面积白色与淡蓝色，少量高饱和红色（嘴内、腮红）
    const pixels = makePixels([
      { rgba: [245, 245, 245, 255], count: 6000 }, // 白色（无色相，应被忽略）
      { rgba: [120, 160, 230, 255], count: 2500 }, // 淡蓝主色
      { rgba: [200, 40, 40, 255], count: 500 }, // 高饱和红色小部件
      { rgba: [0, 0, 0, 0], count: 1000 } // 透明背景
    ])

    const color = pickThemeColorFromPixels([pixels])
    expect(color).not.toBeNull()
    expect(color!.b).toBeGreaterThan(color!.r)
    expect(color!.b).toBeGreaterThan(color!.g)
  })

  it('lets a mid-saturation main color beat a larger low-saturation skin area', () => {
    const pixels = makePixels([
      { rgba: [235, 200, 180, 255], count: 5000 }, // 大面积低饱和肤色
      { rgba: [90, 140, 220, 255], count: 2500 } // 中饱和蓝色服饰
    ])

    const color = pickThemeColorFromPixels([pixels])
    expect(color).not.toBeNull()
    expect(color!.b).toBeGreaterThan(color!.r)
  })

  it('picks red for a predominantly red model', () => {
    const pixels = makePixels([
      { rgba: [220, 60, 60, 255], count: 4000 },
      { rgba: [245, 245, 245, 255], count: 4000 }
    ])

    const color = pickThemeColorFromPixels([pixels])
    expect(color).not.toBeNull()
    expect(color!.r).toBeGreaterThan(color!.b)
  })

  it('merges adjacent hue buckets so a split main hue still wins', () => {
    // 两种蓝分属相邻色相桶（220° 与 230°），单桶面积都小于红色桶，
    // 邻桶合并计票后合计面积应胜出
    const blueA = hsvToRgb(220, 0.6, 0.8)
    const blueB = hsvToRgb(230, 0.6, 0.8)
    const red = hsvToRgb(0, 0.8, 0.8)
    const pixels = makePixels([
      { rgba: [...blueA, 255], count: 1500 },
      { rgba: [...blueB, 255], count: 1500 },
      { rgba: [...red, 255], count: 2000 }
    ])

    const color = pickThemeColorFromPixels([pixels])
    expect(color).not.toBeNull()
    expect(color!.b).toBeGreaterThan(color!.r)
  })

  it('aggregates pixels across multiple textures', () => {
    const blue = makePixels([{ rgba: [90, 140, 220, 255], count: 3000 }])
    const red = makePixels([{ rgba: [200, 40, 40, 255], count: 1000 }])

    const color = pickThemeColorFromPixels([blue, red])
    expect(color).not.toBeNull()
    expect(color!.b).toBeGreaterThan(color!.r)
  })

  it('returns null when no pixel carries hue information', () => {
    const pixels = makePixels([
      { rgba: [0, 0, 0, 0], count: 1000 }, // 透明
      { rgba: [128, 128, 128, 255], count: 1000 }, // 灰
      { rgba: [250, 250, 250, 255], count: 1000 }, // 白
      { rgba: [10, 10, 25, 255], count: 1000 } // 近黑
    ])

    expect(pickThemeColorFromPixels([pixels])).toBeNull()
    expect(pickThemeColorFromPixels([])).toBeNull()
  })
})

describe('extractModelThemeColor', () => {
  it('returns null for empty or unusable canvases', () => {
    expect(extractModelThemeColor([])).toBeNull()

    // node 环境下没有真实 canvas，模拟 getContext 不可用的退化输入
    const fakeCanvas = {
      width: 16,
      height: 16,
      getContext: () => null
    } as unknown as HTMLCanvasElement
    expect(extractModelThemeColor([fakeCanvas])).toBeNull()
  })

  it('reads pixel data through 2d context when available', () => {
    const pixels = makePixels([{ rgba: [90, 140, 220, 255], count: 1024 }])
    const fakeCanvas = {
      width: 32,
      height: 32,
      getContext: () => ({
        getImageData: () => ({ data: pixels })
      })
    } as unknown as HTMLCanvasElement

    const color = extractModelThemeColor([fakeCanvas])
    expect(color).not.toBeNull()
    expect(color!.b).toBeGreaterThan(color!.r)
  })
})
