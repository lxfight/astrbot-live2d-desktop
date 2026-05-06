import { describe, expect, it } from 'vitest'

import { CubismModel } from '../src/utils/cubism/CubismModel'

describe('CubismModel expression runtime', () => {
  it('restores the previous legacy expression when a held combo expires', () => {
    const model = Object.create(CubismModel.prototype) as any
    const restored: string[] = []

    model.activeExpressionRuntime = {
      members: [{ id: 'Smile', weight: 1, order: 0, parsed: { parameters: [] }, conflictGroups: [] }],
      previous: null,
      previousLegacyExpressionName: 'IdleSmile',
      holdUntil: Date.now() - 1,
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
})
