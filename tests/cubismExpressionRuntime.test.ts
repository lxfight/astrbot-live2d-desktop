import { afterEach, describe, expect, it, vi } from 'vitest'

import { CubismModel } from '../src/utils/cubism/CubismModel'

describe('CubismModel expression runtime', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('restores the previous legacy expression when a held combo expires', () => {
    const model = Object.create(CubismModel.prototype) as any
    const restored: string[] = []

    model.activeExpressionRuntime = {
      members: [{ id: 'Smile', weight: 1, order: 0, parsed: { parameters: [] }, conflictGroups: [] }],
      previous: null,
      previousLegacyExpressionName: 'IdleSmile',
      holdUntil: Date.now() - 1,
      startedAt: Date.now() - 1000,
      fadeInMs: 0,
      fadeOutMs: 0,
      fadeOutStartedAt: null,
      resetPolicy: 'previous',
    }
    model.playLegacyExpressionByName = (expressionName: string) => {
      restored.push(expressionName)
      return true
    }

    model.refreshActiveExpressionRuntime()

    expect(restored).toEqual(['IdleSmile'])
    expect(model.activeExpressionRuntime).toBeNull()
  })

  it('falls back to legacy expression playback when parsed exp3 parameters are unavailable', () => {
    const model = Object.create(CubismModel.prototype) as any
    const played: string[] = []

    model.expressionFiles = [{
      name: 'Smile',
      file: 'Smile.exp3.json',
      expression: {},
      aliases: ['Smile'],
      parseWarnings: ['表情文件未解析出可执行参数，已回退到原生表情运行时'],
    }]
    model.expressionCatalogMap = new Map()
    model.semanticPresets = {}
    model.playLegacyExpressionByName = (expressionName: string) => {
      played.push(expressionName)
      return true
    }

    model.expression('Smile')

    expect(played).toEqual(['Smile'])
  })

  it('resolves expression aliases and case-insensitive ids for legacy playback', () => {
    const model = Object.create(CubismModel.prototype) as any
    const played: string[] = []

    model.expressionFiles = [{
      name: 'Smile',
      file: 'Smile.exp3.json',
      expression: {},
      aliases: ['happy_face', '开心'],
      parseWarnings: [],
    }]
    model.expressionCatalogMap = new Map()
    model.semanticPresets = {}
    model.playLegacyExpressionByName = (expressionName: string) => {
      played.push(expressionName)
      return true
    }

    model.expression(' HAPPY_FACE ')

    expect(played).toEqual(['Smile'])
  })

  it('applies protocol fade to custom expression runtime weights', () => {
    const model = Object.create(CubismModel.prototype) as any
    const appliedWeights: number[] = []
    const now = vi.spyOn(Date, 'now')

    model.applyParsedExpression = (_model: unknown, _parsed: unknown, weight: number) => {
      appliedWeights.push(weight)
    }

    now.mockReturnValue(1000)
    model.beginCustomExpressionRuntime(
      [{
        id: 'Smile',
        weight: 0.8,
        order: 0,
        parsed: { parameters: [], fadeInMs: 1000, fadeOutMs: 1000 },
        conflictGroups: [],
      }],
      { fade: 400 }
    )

    now.mockReturnValue(1100)
    model.updateCustomExpressionRuntime({})
    now.mockReturnValue(1400)
    model.updateCustomExpressionRuntime({})

    expect(appliedWeights[0]).toBeCloseTo(0.2)
    expect(appliedWeights[1]).toBeCloseTo(0.8)
  })

  it('fades out custom expression runtime before restoring previous legacy expression', () => {
    const model = Object.create(CubismModel.prototype) as any
    const appliedWeights: number[] = []
    const restored: string[] = []
    const now = vi.spyOn(Date, 'now')

    model.applyParsedExpression = (_model: unknown, _parsed: unknown, weight: number) => {
      appliedWeights.push(weight)
    }
    model.playLegacyExpressionByName = (expressionName: string) => {
      restored.push(expressionName)
      return true
    }

    now.mockReturnValue(1000)
    model.beginCustomExpressionRuntime(
      [{
        id: 'Smile',
        weight: 1,
        order: 0,
        parsed: { parameters: [], fadeInMs: 0, fadeOutMs: 400 },
        conflictGroups: [],
      }],
      { holdMs: 100, resetPolicy: 'previous' }
    )
    model.activeExpressionRuntime.previousLegacyExpressionName = 'IdleSmile'

    now.mockReturnValue(1100)
    model.updateCustomExpressionRuntime({})
    expect(restored).toEqual([])
    expect(appliedWeights[0]).toBeCloseTo(1)

    now.mockReturnValue(1300)
    model.updateCustomExpressionRuntime({})
    expect(restored).toEqual([])
    expect(appliedWeights[1]).toBeCloseTo(0.5)

    now.mockReturnValue(1500)
    model.updateCustomExpressionRuntime({})
    expect(restored).toEqual(['IdleSmile'])
    expect(model.activeExpressionRuntime).toBeNull()
  })

  it('randomly picks an executable expression from semantic type presets with visible weight', () => {
    const model = Object.create(CubismModel.prototype) as any
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.8)

    model.semanticPresets = {
      happy: ['SmileA', 'SmileB'],
    }
    model.expressionFiles = [
      { name: 'SmileA', aliases: ['SmileA'], parsed: { parameters: [] } },
      { name: 'SmileB', aliases: ['SmileB'], parsed: { parameters: [] } },
    ]
    model.expressionCatalogMap = new Map()

    const members = model.resolveExpressionMembers({
      semantic: [{ tag: 'happy', weight: 0.7 }],
    })

    expect(randomSpy).toHaveBeenCalled()
    expect(members).toEqual([
      expect.objectContaining({
        id: 'SmileB',
        weight: 0.8,
      }),
    ])
  })
})
