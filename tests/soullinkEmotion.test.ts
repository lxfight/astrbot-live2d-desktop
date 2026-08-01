import { describe, expect, it } from 'vitest'

import {
  SoullinkEmotionController,
  addDiscoveredSoullinkExpressions,
  createStandardSoullinkProfile
} from '../src/utils/soullinkEmotion'

describe('Soullink emotion integration', () => {
  it('creates a conservative standard Cubism profile', () => {
    const profile = createStandardSoullinkProfile('/models/avatar/model.model3.json', 'Avatar')

    expect(profile.displayName).toBe('Avatar')
    expect(profile.parameterMap.headX?.target).toBe('ParamAngleX')
    expect(profile.parameterMap.mouthSmile?.target).toBe('ParamMouthForm')
    expect(profile.parameterMap.mouthFrown?.target).toBe('ParamMouthForm')
    expect(profile.parameterMap.eyeSmile?.targets).toEqual(['ParamEyeLSmile', 'ParamEyeRSmile'])
    expect(profile.parameterMap.gazeX?.target).toBe('ParamEyeBallX')
    expect(profile.parameterMap.mouthOpen).toBeUndefined()
    expect(profile.parameterMap.eyeOpen).toBeUndefined()
  })

  it('updates locally and can be disabled without a runtime failure', () => {
    const controller = new SoullinkEmotionController()
    controller.configure(
      createStandardSoullinkProfile('/models/avatar/model.model3.json', 'Avatar')
    )

    expect(controller.triggerMessage('今天终于成功了')).not.toBeNull()
    expect(controller.update(performance.now() + 16)?.live2dParams).toBeTruthy()

    controller.setEnabled(false)
    expect(controller.update(performance.now() + 32)).toBeNull()
    expect(controller.triggerMessage('这次不应该触发')).toBeNull()
  })

  it('rejects an empty explicit intent and clamps a valid one', () => {
    const controller = new SoullinkEmotionController()
    controller.configure(
      createStandardSoullinkProfile('/models/avatar/model.model3.json', 'Avatar')
    )

    expect(controller.triggerIntent({ emotion: ' ', intensity: 1 })).toBe(false)
    expect(controller.triggerIntent({ emotion: 'happy', intensity: 4 })).toBe(true)
  })

  it('uses parameter mappings from a model-specific profile', () => {
    const controller = new SoullinkEmotionController()
    const profile = createStandardSoullinkProfile('/models/avatar/model.model3.json', 'Avatar')
    profile.parameterMap.headX = {
      ...profile.parameterMap.headX,
      target: 'ParamAvatarHeadX'
    }
    controller.configure(profile)

    controller.triggerIntent({ emotion: 'happy', intensity: 1 })
    const frame = controller.update(performance.now() + 250)

    expect(frame?.live2dParams.ParamAvatarHeadX).toBeTypeOf('number')
    expect(frame?.live2dParams.ParamAngleX).toBeUndefined()
    expect(frame?.live2dParams.ParamEyeLSmile).toBeTypeOf('number')
    expect(frame?.live2dParams.ParamEyeBallX).toBeTypeOf('number')
  })

  it('maps discovered model expressions to native Soullink accents', () => {
    const profile = addDiscoveredSoullinkExpressions(
      createStandardSoullinkProfile('/models/avatar/model.model3.json', 'Avatar'),
      [
        { id: '哭哭', aliases: ['表情哭哭'], tags: ['sad'] },
        { id: '星星眼', aliases: ['表情星星眼'], tags: [] },
        { id: '脸红', aliases: ['表情脸红'], tags: [] }
      ]
    )

    expect(profile.expressionMap?.sad).toMatchObject({ expression: '哭哭' })
    expect(profile.expressionMap?.happy).toMatchObject({ expression: '星星眼' })
    expect(profile.expressionMap?.blush).toMatchObject({ expression: '脸红' })

    const controller = new SoullinkEmotionController()
    controller.configure(profile)
    controller.triggerIntent({ emotion: 'happy', intensity: 0.82 })

    expect(controller.update(performance.now() + 16)?.nativeAnimation?.expression).toBe('星星眼')
  })

  it('suppresses native accents when the performance already directs an animation', () => {
    const profile = addDiscoveredSoullinkExpressions(
      createStandardSoullinkProfile('/models/avatar/model.model3.json', 'Avatar'),
      [{ id: '星星眼', tags: ['happy'] }]
    )
    const controller = new SoullinkEmotionController()
    controller.configure(profile)
    controller.triggerIntent({ emotion: 'happy', intensity: 0.82 }, { allowNativeAnimation: false })

    expect(controller.update(performance.now() + 16)?.nativeAnimation).toBeNull()
  })
})
