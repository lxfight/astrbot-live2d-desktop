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
    expect(profile.parameterMap.mouthOpen).toBeUndefined()
    expect(profile.parameterMap.eyeOpen).toBeUndefined()
  })

  it('updates locally and can be disabled without a runtime failure', () => {
    const controller = new SoullinkEmotionController()
    controller.configure('/models/avatar/model.model3.json', 'Avatar')

    expect(controller.triggerMessage('今天终于成功了')).not.toBeNull()
    expect(controller.update(performance.now() + 16)?.live2dParams).toBeTruthy()

    controller.setEnabled(false)
    expect(controller.update(performance.now() + 32)).toBeNull()
    expect(controller.triggerMessage('这次不应该触发')).toBeNull()
  })

  it('rejects an empty explicit intent and clamps a valid one', () => {
    const controller = new SoullinkEmotionController()
    controller.configure('/models/avatar/model.model3.json', 'Avatar')

    expect(controller.triggerIntent({ emotion: ' ', intensity: 1 })).toBe(false)
    expect(controller.triggerIntent({ emotion: 'happy', intensity: 4 })).toBe(true)
  })
})
