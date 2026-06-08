import { describe, expect, it } from 'vitest'

import { CubismModel } from '../src/utils/cubism/CubismModel'

describe('CubismModel getModelInfo', () => {
  it('only exposes executable motions and expressions', () => {
    const model = Object.create(CubismModel.prototype) as any

    model.modelPath = '/models/Sample/Sample.model3.json'
    model.getModelName = () => 'Sample'
    model.motionGroups = new Map([
      ['Idle', [{ file: 'idle.motion3.json', motion: {} }]],
      ['Broken', [{ file: 'broken.motion3.json' }]]
    ])
    model.expressionFiles = [
      {
        name: 'Smile',
        file: 'Smile.exp3.json',
        expression: {},
        aliases: ['smile'],
        source: 'model3',
        parseWarnings: []
      },
      {
        name: 'Broken',
        file: 'Broken.exp3.json',
        aliases: ['broken'],
        source: 'scan',
        parseWarnings: []
      }
    ]
    model.expressionCatalogSummary = [
      {
        id: 'Smile',
        aliases: ['Smile', 'smile'],
        tags: ['happy'],
        conflictGroups: ['emotion'],
        supportsCombo: true
      },
      {
        id: 'Broken',
        aliases: ['Broken', 'broken'],
        tags: ['sad'],
        conflictGroups: ['emotion'],
        supportsCombo: true
      }
    ]
    model.semanticPresets = { happy: ['Smile'], sad: ['Broken'] }
    model.hasExpressionProfile = true
    model.discoveryInfo = null

    const info = model.getModelInfo()

    expect(info.motionGroups).toEqual({
      Idle: [{ index: 0, file: 'idle.motion3.json' }]
    })
    expect(info.expressions).toEqual(['Smile'])
    expect(info.expressionCatalog).toEqual([
      {
        id: 'Smile',
        aliases: ['Smile', 'smile'],
        tags: ['happy'],
        conflictGroups: ['emotion'],
        supportsCombo: true
      }
    ])
    expect(info.semanticPresets).toEqual({ happy: ['Smile'] })
  })
})
