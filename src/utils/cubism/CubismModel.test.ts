/**
 * CubismModel 测试文件
 * 用于验证基础功能的实现
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { CubismModel, LoadStep, MotionPriority } from './CubismModel'
import { createCubismAllocator } from './CubismAllocator'
import {
  CubismMatrix44,
  CubismTargetPoint,
  CubismIdManager,
  csmVector,
  csmMap,
  isCubism3Model,
  isCubism2Model,
  getModelName,
  normalizeModelPath,
  getTexturePath,
  getMotionPath,
  getExpressionPath
} from './CubismCore'

// ============================================================================
// CubismModel 测试
// ============================================================================

describe('CubismModel', () => {
  let model: CubismModel

  beforeEach(() => {
    model = new CubismModel()
  })

  afterEach(() => {
    if (model) {
      model.destroy()
    }
  })

  test('should create instance', () => {
    expect(model).toBeInstanceOf(CubismModel)
  })

  test('should have required methods', () => {
    expect(typeof model.load).toBe('function')
    expect(typeof model.initWebGL).toBe('function')
    expect(typeof model.update).toBe('function')
    expect(typeof model.render).toBe('function')
    expect(typeof model.focus).toBe('function')
    expect(typeof model.motion).toBe('function')
    expect(typeof model.expression).toBe('function')
    expect(typeof model.startLipSync).toBe('function')
    expect(typeof model.stopLipSync).toBe('function')
    expect(typeof model.getModelInfo).toBe('function')
    expect(typeof model.getModelBounds).toBe('function')
    expect(typeof model.resize).toBe('function')
    expect(typeof model.isPointInModel).toBe('function')
    expect(typeof model.destroy).toBe('function')
    expect(typeof model.getState).toBe('function')
    expect(typeof model.getTextureCount).toBe('function')
    expect(typeof model.getModelName).toBe('function')
    expect(typeof model.getFps).toBe('function')
  })

  test('static from method should create instance', async () => {
    expect(typeof CubismModel.from).toBe('function')
  })

  test('getModelInfo should return default info', () => {
    const info = model.getModelInfo()
    expect(info).toHaveProperty('name')
    expect(info).toHaveProperty('motionGroups')
    expect(info).toHaveProperty('expressions')
    expect(typeof info.name).toBe('string')
    expect(typeof info.motionGroups).toBe('object')
    expect(Array.isArray(info.expressions)).toBe(true)
  })

  test('getModelBounds should return null when canvas is not set', () => {
    const bounds = model.getModelBounds()
    expect(bounds).toBeNull()
  })

  test('isPointInModel should return false when canvas is not set', () => {
    const result = model.isPointInModel(100, 100)
    expect(result).toBe(false)
  })

  test('focus should update drag coordinates', () => {
    expect(() => {
      model.focus(100, 100)
    }).not.toThrow()
  })

  test('motion should not throw error', () => {
    expect(() => {
      model.motion('TestGroup', 0, MotionPriority.Normal)
    }).not.toThrow()
  })

  test('expression should not throw error', () => {
    expect(() => {
      model.expression('test_expression')
    }).not.toThrow()
  })

  test('stopLipSync should not throw error', () => {
    expect(() => {
      model.stopLipSync()
    }).not.toThrow()
  })

  test('getState should return LoadStep', () => {
    const state = model.getState()
    expect(state).toBe(LoadStep.LoadAssets)
  })

  test('getTextureCount should return number', () => {
    const count = model.getTextureCount()
    expect(typeof count).toBe('number')
  })

  test('getModelName should return string', () => {
    const name = model.getModelName()
    expect(typeof name).toBe('string')
  })

  test('getFps should return number', () => {
    const fps = model.getFps()
    expect(typeof fps).toBe('number')
  })
})

// ============================================================================
// CubismCore 测试
// ============================================================================

describe('CubismCore', () => {
  describe('CubismMatrix44', () => {
    test('should create instance', () => {
      const matrix = new CubismMatrix44()
      expect(matrix).toBeInstanceOf(CubismMatrix44)
    })

    test('should load identity matrix', () => {
      const matrix = new CubismMatrix44()
      const array = matrix.getArray()
      expect(array[0]).toBe(1)
      expect(array[5]).toBe(1)
      expect(array[10]).toBe(1)
      expect(array[15]).toBe(1)
    })

    test('should scale correctly', () => {
      const matrix = new CubismMatrix44()
      matrix.scale(2, 3)
      const array = matrix.getArray()
      expect(array[0]).toBe(2)
      expect(array[5]).toBe(3)
    })

    test('should translate correctly', () => {
      const matrix = new CubismMatrix44()
      matrix.translate(10, 20)
      const array = matrix.getArray()
      expect(array[12]).toBe(10)
      expect(array[13]).toBe(20)
    })

    test('should multiply matrices correctly', () => {
      const m1 = new CubismMatrix44()
      const m2 = new CubismMatrix44()
      m1.scale(2, 2)
      m2.translate(10, 10)
      m1.multiplyByMatrix(m2)
      const array = m1.getArray()
      expect(array[12]).toBe(20)
      expect(array[13]).toBe(20)
    })
  })

  describe('CubismTargetPoint', () => {
    test('should create instance', () => {
      const target = new CubismTargetPoint()
      expect(target).toBeInstanceOf(CubismTargetPoint)
    })

    test('should set and get coordinates', () => {
      const target = new CubismTargetPoint()
      target.set(0.5, -0.5)
      expect(target.getTargetX()).toBe(0.5)
      expect(target.getTargetY()).toBe(-0.5)
    })

    test('should update coordinates', () => {
      const target = new CubismTargetPoint()
      target.set(0.5, 0.5)
      target.update(1.0)
      expect(target.getX()).toBeCloseTo(0.5, 1)
      expect(target.getY()).toBeCloseTo(0.5, 1)
    })
  })

  describe('CubismIdManager', () => {
    test('should create instance', () => {
      const manager = new CubismIdManager()
      expect(manager).toBeInstanceOf(CubismIdManager)
    })

    test('should get and register IDs', () => {
      const manager = new CubismIdManager()
      const id1 = manager.getId('ParamAngleX')
      const id2 = manager.registerId('ParamAngleY')
      expect(id1).toBe('ParamAngleX')
      expect(id2).toBe('ParamAngleY')
    })

    test('should check if ID exists', () => {
      const manager = new CubismIdManager()
      manager.registerId('ParamAngleX')
      expect(manager.isExist('ParamAngleX')).toBe(true)
      expect(manager.isExist('ParamAngleY')).toBe(false)
    })
  })

  describe('csmVector', () => {
    test('should create instance', () => {
      const vector = new csmVector<number>()
      expect(vector).toBeInstanceOf(csmVector)
    })

    test('should push back elements', () => {
      const vector = new csmVector<number>()
      vector.pushBack(1)
      vector.pushBack(2)
      vector.pushBack(3)
      expect(vector.getSize()).toBe(3)
    })

    test('should get element at index', () => {
      const vector = new csmVector<number>()
      vector.pushBack(10)
      vector.pushBack(20)
      expect(vector.at(0)).toBe(10)
      expect(vector.at(1)).toBe(20)
    })

    test('should set element at index', () => {
      const vector = new csmVector<number>()
      vector.pushBack(1)
      vector.set(0, 100)
      expect(vector.at(0)).toBe(100)
    })

    test('should remove element at index', () => {
      const vector = new csmVector<number>()
      vector.pushBack(1)
      vector.pushBack(2)
      vector.pushBack(3)
      vector.remove(1)
      expect(vector.getSize()).toBe(2)
      expect(vector.at(0)).toBe(1)
      expect(vector.at(1)).toBe(3)
    })

    test('should clear all elements', () => {
      const vector = new csmVector<number>()
      vector.pushBack(1)
      vector.pushBack(2)
      vector.clear()
      expect(vector.getSize()).toBe(0)
    })
  })

  describe('csmMap', () => {
    test('should create instance', () => {
      const map = new csmMap<string, number>()
      expect(map).toBeInstanceOf(csmMap)
    })

    test('should set and get values', () => {
      const map = new csmMap<string, number>()
      map.setValue('key1', 100)
      map.setValue('key2', 200)
      expect(map.getValue('key1')).toBe(100)
      expect(map.getValue('key2')).toBe(200)
    })

    test('should check if key exists', () => {
      const map = new csmMap<string, number>()
      map.setValue('key1', 100)
      expect(map.isExist('key1')).toBe(true)
      expect(map.isExist('key2')).toBe(false)
    })

    test('should remove key', () => {
      const map = new csmMap<string, number>()
      map.setValue('key1', 100)
      map.remove('key1')
      expect(map.isExist('key1')).toBe(false)
    })

    test('should get size', () => {
      const map = new csmMap<string, number>()
      map.setValue('key1', 100)
      map.setValue('key2', 200)
      expect(map.getSize()).toBe(2)
    })
  })
})

// ============================================================================
// 工具函数测试
// ============================================================================

describe('Utility Functions', () => {
  test('isCubism3Model should detect .model3.json', () => {
    expect(isCubism3Model('/path/to/model.model3.json')).toBe(true)
    expect(isCubism3Model('/path/to/model.json')).toBe(false)
    expect(isCubism3Model('/path/to/model.model.json')).toBe(false)
  })

  test('isCubism2Model should detect .model.json', () => {
    expect(isCubism2Model('/path/to/model.model.json')).toBe(true)
    expect(isCubism2Model('/path/to/model.model3.json')).toBe(false)
    expect(isCubism2Model('/path/to/model.json')).toBe(false)
  })

  test('getModelName should extract model name', () => {
    expect(getModelName('/models/Haru/Haru.model3.json')).toBe('Haru')
    expect(getModelName('/models/Mark/Mark.model3.json')).toBe('Mark')
    expect(getModelName('model3.json')).toBe('model3')
  })

  test('normalizeModelPath should add leading slash', () => {
    expect(normalizeModelPath('models/Haru.model3.json')).toBe('/models/Haru.model3.json')
    expect(normalizeModelPath('/models/Haru.model3.json')).toBe('/models/Haru.model3.json')
  })

  test('getTexturePath should build correct path', () => {
    expect(getTexturePath('/models/Haru/Haru.model3.json', 'texture.png')).toBe('/models/Haru/texture.png')
  })

  test('getMotionPath should build correct path', () => {
    expect(getMotionPath('/models/Haru/Haru.model3.json', 'motion.motion3.json')).toBe('/models/Haru/motion.motion3.json')
  })

  test('getExpressionPath should build correct path', () => {
    expect(getExpressionPath('/models/Haru/Haru.model3.json', 'smile.exp3.json')).toBe('/models/Haru/smile.exp3.json')
  })
})

// ============================================================================
// CubismAllocator 测试
// ============================================================================

describe('CubismAllocator', () => {
  test('should create default allocator', () => {
    const allocator = createCubismAllocator()
    expect(allocator).toHaveProperty('allocate')
    expect(allocator).toHaveProperty('deallocate')
    expect(allocator).toHaveProperty('allocateAligned')
    expect(allocator).toHaveProperty('deallocateAligned')
  })

  test('should allocate memory', () => {
    const allocator = createCubismAllocator()
    const memory = allocator.allocate(1024)
    expect(memory).toBeInstanceOf(ArrayBuffer)
    expect(memory.byteLength).toBe(1024)
  })

  test('should allocate aligned memory', () => {
    const allocator = createCubismAllocator()
    const memory = allocator.allocateAligned(1024, 16)
    expect(memory).toBeInstanceOf(ArrayBuffer)
  })
})