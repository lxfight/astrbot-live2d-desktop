// @ts-nocheck
/**
 * CubismWebFramework 入口文件
 * 
 * 这个文件导出了 Live2D Cubism SDK for Web 的完整框架
 * 基于官方 CubismWebSamples/Framework 源码
 */

// Framework 核心
export { CubismFramework, Option, Constant } from './live2dcubismframework'

// ID 管理
export { CubismIdManager } from './id/cubismidmanager'
export { CubismId } from './id/cubismid'

// 模型相关
export { CubismMoc } from './model/cubismmoc'
export { CubismModel } from './model/cubismmodel'
export { CubismUserModel } from './model/cubismusermodel'
export { CubismModelSettingJson } from './cubismmodelsettingjson'
export type { ICubismModelSetting } from './icubismmodelsetting'

// 动作相关
export { CubismMotionManager } from './motion/cubismmotionmanager'
export { CubismMotion } from './motion/cubismmotion'
export { CubismExpressionMotionManager } from './motion/cubismexpressionmotionmanager'
export { CubismExpressionMotion } from './motion/cubismexpressionmotion'

// 效果相关
export { CubismEyeBlink } from './effect/cubismeyeblink'
export { CubismBreath } from './effect/cubismbreath'
export { CubismPose } from './effect/cubismpose'

// 物理演算
export { CubismPhysics } from './physics/cubismphysics'

// 数学工具
export { CubismMatrix44 } from './math/cubismmatrix44'
export { CubismModelMatrix } from './math/cubismmodelmatrix'
export { CubismViewMatrix } from './math/cubismviewmatrix'
export { CubismTargetPoint } from './math/cubismtargetpoint'
export { CubismVector2 } from './math/cubismvector2'
export { CubismMath } from './math/cubismmath'

// 渲染器
export { CubismRenderer_WebGL } from './rendering/cubismrenderer_webgl'
export { CubismRenderer } from './rendering/cubismrenderer'

// 工具类
export { CubismModelUserData } from './model/cubismmodeluserdata'

// 配置
export * from './cubismframeworkconfig'
export * from './cubismdefaultparameterid'

// 内存分配器接口
export type { ICubismAllocator } from './icubismallcator'

// 类型定义
export { csmRect } from './type/csmrectf'
export type { csmRect as csmRectF } from './type/csmrectf'

// 工具函数
export { strtod } from './live2dcubismframework'
