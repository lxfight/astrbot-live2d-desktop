/**
 * Cubism SDK 模块导出
 */

// 主要类
export { CubismModel } from './CubismModel';
export type { 
  CubismAllocator, 
  DefaultCubismAllocator, 
  DebugCubismAllocator, 
  createCubismAllocator 
} from './CubismAllocator';

// 常量
export * from './constants';

// 类型定义
export type CubismModelInfo = {
  name: string;
  motionGroups: Record<string, Array<{ index: number; file: string }>>;
  expressions: string[];
};

export type ModelBounds = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
};

export type Position = {
  x: number;
  y: number;
};

// 工具函数
export function isCubism3Model(modelPath: string): boolean {
  return modelPath.toLowerCase().endsWith('.model3.json');
}

export function isCubism2Model(modelPath: string): boolean {
  return modelPath.toLowerCase().endsWith('.model.json') && 
         !modelPath.toLowerCase().endsWith('.model3.json');
}

export function getModelName(modelPath: string): string {
  return modelPath.split('/').filter(Boolean).pop()?.replace(/\.(model|model3)\.json$/, '') || 'unknown';
}

export function normalizeModelPath(modelPath: string): string {
  // 确保路径以 / 开头
  if (!modelPath.startsWith('/')) {
    return '/' + modelPath;
  }
  return modelPath;
}

export function getTexturePath(modelPath: string, textureFileName: string): string {
  const modelDir = modelPath.substring(0, modelPath.lastIndexOf('/') + 1);
  return modelDir + textureFileName;
}

export function getMotionPath(modelPath: string, motionFileName: string): string {
  const modelDir = modelPath.substring(0, modelPath.lastIndexOf('/') + 1);
  return modelDir + motionFileName;
}

export function getExpressionPath(modelPath: string, expressionFileName: string): string {
  const modelDir = modelPath.substring(0, modelPath.lastIndexOf('/') + 1);
  return modelDir + expressionFileName;
}

export function getPhysicsPath(modelPath: string, physicsFileName: string): string {
  const modelDir = modelPath.substring(0, modelPath.lastIndexOf('/') + 1);
  return modelDir + physicsFileName;
}

export function getPosePath(modelPath: string, poseFileName: string): string {
  const modelDir = modelPath.substring(0, modelPath.lastIndexOf('/') + 1);
  return modelDir + poseFileName;
}