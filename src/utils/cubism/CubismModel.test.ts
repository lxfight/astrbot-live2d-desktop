/**
 * CubismModel 测试文件
 * 用于验证基础功能的实现
 */

import { CubismModel } from './CubismModel';
import { createCubismAllocator } from './CubismAllocator';

describe('CubismModel', () => {
  let model: CubismModel;
  
  beforeEach(() => {
    model = new CubismModel();
  });
  
  afterEach(() => {
    if (model) {
      model.destroy();
    }
  });
  
  test('should create instance', () => {
    expect(model).toBeInstanceOf(CubismModel);
  });
  
  test('should have required methods', () => {
    expect(typeof model.load).toBe('function');
    expect(typeof model.initWebGL).toBe('function');
    expect(typeof model.update).toBe('function');
    expect(typeof model.render).toBe('function');
    expect(typeof model.focus).toBe('function');
    expect(typeof model.motion).toBe('function');
    expect(typeof model.expression).toBe('function');
    expect(typeof model.startLipSync).toBe('function');
    expect(typeof model.stopLipSync).toBe('function');
    expect(typeof model.getModelInfo).toBe('function');
    expect(typeof model.getModelBounds).toBe('function');
    expect(typeof model.resize).toBe('function');
    expect(typeof model.isPointInModel).toBe('function');
    expect(typeof model.destroy).toBe('function');
  });
  
  test('static from method should create instance', async () => {
    // 由于没有真实的模型文件，这里只测试方法是否存在
    expect(typeof CubismModel.from).toBe('function');
  });
  
  test('getModelInfo should return default info', () => {
    const info = model.getModelInfo();
    expect(info).toHaveProperty('name');
    expect(info).toHaveProperty('motionGroups');
    expect(info).toHaveProperty('expressions');
    expect(typeof info.name).toBe('string');
    expect(typeof info.motionGroups).toBe('object');
    expect(Array.isArray(info.expressions)).toBe(true);
  });
  
  test('getModelBounds should return null when canvas is not set', () => {
    const bounds = model.getModelBounds();
    expect(bounds).toBeNull();
  });
  
  test('isPointInModel should return false when canvas is not set', () => {
    const result = model.isPointInModel(100, 100);
    expect(result).toBe(false);
  });
  
  test('focus should update drag coordinates', () => {
    // 这里只是测试方法不会抛出错误
    expect(() => {
      model.focus(100, 100);
    }).not.toThrow();
  });
  
  test('motion should not throw error', () => {
    expect(() => {
      model.motion('TestGroup', 0, 1);
    }).not.toThrow();
  });
  
  test('expression should not throw error', () => {
    expect(() => {
      model.expression('test_expression');
    }).not.toThrow();
  });
  
  test('stopLipSync should not throw error', () => {
    expect(() => {
      model.stopLipSync();
    }).not.toThrow();
  });
});

describe('CubismAllocator', () => {
  test('should create default allocator', () => {
    const allocator = createCubismAllocator();
    expect(allocator).toHaveProperty('allocate');
    expect(allocator).toHaveProperty('deallocate');
    expect(allocator).toHaveProperty('allocateAligned');
    expect(allocator).toHaveProperty('deallocateAligned');
  });
  
  test('should allocate memory', () => {
    const allocator = createCubismAllocator();
    const memory = allocator.allocate(1024);
    expect(memory).toBeInstanceOf(ArrayBuffer);
    expect(memory.byteLength).toBe(1024);
  });
  
  test('should allocate aligned memory', () => {
    const allocator = createCubismAllocator();
    const memory = allocator.allocateAligned(1024, 16);
    expect(memory).toBeInstanceOf(ArrayBuffer);
  });
});