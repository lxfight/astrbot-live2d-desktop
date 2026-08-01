import { describe, expect, it } from 'vitest'

import {
  SoullinkEmotionController,
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
    expect(profile.parameterMap.mouthOpen?.target).toBe('ParamMouthOpenY')
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

  it('translates adapter emotion names to Soullink dynamic archetypes', () => {
    const controller = new SoullinkEmotionController()
    controller.configure(
      createStandardSoullinkProfile('/models/avatar/model.model3.json', 'Avatar')
    )

    controller.triggerIntent({ emotion: 'anxious', intensity: 1 })
    const anxiousFrame = controller.update(performance.now() + 250)

    const blushController = new SoullinkEmotionController()
    blushController.configure(
      createStandardSoullinkProfile('/models/avatar/model.model3.json', 'Avatar')
    )
    blushController.triggerIntent({ emotion: 'blush', intensity: 1 })
    const blushFrame = blushController.update(performance.now() + 500)

    expect(anxiousFrame?.live2dParams.ParamBrowLY).toBeGreaterThan(0)
    expect(blushFrame?.live2dParams.ParamEyeLSmile).toBeGreaterThan(0)
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
})
