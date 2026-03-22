# Live2D Cubism SDK 迁移实现方案

## 一、技术选型

### 当前状态
- **生产环境**：使用 `pixi-live2d-display@0.4.0`（基于 Cubism 4）
- **新的 SDK 目录**：`src/utils/cubism/` 包含空壳实现

### 技术方案
**目标**：实现原生 Cubism SDK 支持，同时保持与现有 `pixi-live2d-display` 的兼容性

**策略**：
1. 保留 `Live2DModel.ts` 作为默认实现（基于 pixi-live2d-display）
2. 完善 `src/utils/cubism/` 作为可选的原生实现
3. 通过配置切换使用哪种实现

---

## 二、功能清单与实现映射

### 核心功能清单

| # | 功能 | pixi-live2d-display | Cubism SDK 需要实现 |
|---|------|---------------------|---------------------|
| 1 | 模型加载 | `Live2DModel.load()` | `CubismModel.load()` |
| 2 | WebGL 渲染 | PIXI Application | `CubismRenderer_WebGL` |
| 3 | 模型缩放/定位 | `model.scale.set()` | `CubismMatrix44` |
| 4 | 口型同步 | Web Audio API | `CubismAudioManager` |
| 5 | 动作播放 | `model.motion()` | `CubismMotionManager` |
| 6 | 表情切换 | `model.expression()` | `CubismExpressionMotionManager` |
| 7 | 眼睛注视 | `model.focus()` | `CubismTargetPoint` + 参数设置 |
| 8 | 眼睛眨动 | 自动 | `CubismEyeBlink` |
| 9 | 呼吸效果 | 自动 | `CubismBreath` |
| 10 | 物理演算 | 自动 | `CubismPhysics` |
| 11 | 姿势系统 | 自动 | `CubismPose` |
| 12 | 动作组列表 | `motionManager.definitions` | `modelSetting.getMotionGroupCount()` |
| 13 | 表情列表 | `expressionManager.definitions` | `modelSetting.getExpressionCount()` |
| 14 | 模型信息 | `getModelInfo()` | `getModelInfo()` |
| 15 | 纹理源 | `model.texture.baseTexture.resource` | `renderer.getTexture()` |
| 16 | 模型边界 | `model.getBounds()` | `getModelBounds()` |

### 前端交互功能

| # | 功能 | 位置 | 说明 |
|---|------|------|------|
| 17 | 鼠标拖拽 | `Canvas.vue` | 需要在 CubismModel 中暴露位置设置方法 |
| 18 | 点击检测 | `Canvas.vue` | 需要在 CubismModel 中暴露碰撞检测方法 |
| 19 | 右键菜单 | `Canvas.vue` | 独立于 Live2D 实现 |
| 20 | 动态穿透 | `Canvas.vue` | 独立于 Live2D 实现 |

### 状态管理功能

| # | 功能 | 位置 | 说明 |
|---|------|------|------|
| 21 | 模型路径 | `model.ts` | 独立于 Live2D 实现 |
| 22 | 模型位置 | `model.ts` | 独立于 Live2D 实现 |
| 23 | 模型列表 | IPC | 独立于 Live2D 实现 |

### 表演系统功能

| # | 功能 | 位置 | 说明 |
|---|------|------|------|
| 24 | 表演队列 | `PerformanceQueue.ts` | 已解耦，无需修改 |
| 25 | 可中断表演 | `PerformanceQueue.ts` | 已解耦，无需修改 |
| 26 | 多种指令类型 | `PerformanceQueue.ts` | 已解耦，无需修改 |

---

## 三、Cubism SDK 类实现清单

### 需要实现的核心类

#### 1. CubismFramework (框架初始化)
```typescript
class CubismFramework {
  static startUp(allocator: CubismAllocator): void
  static initialize(): void
  static dispose(): void
}
```

#### 2. CubismUserModel (用户模型)
```typescript
class CubismUserModel {
  loadModel(buffer: ArrayBuffer): void
  createRenderer(width: number, height: number): CubismRenderer_WebGL
  getRenderer(): CubismRenderer_WebGL
  getModel(): CubismModel
  getModelMatrix(): CubismMatrix44
  update(): void
  loadParameters(): void
  saveParameters(): void
  isHit(drawableId: string, x: number, y: number): boolean
}
```

#### 3. CubismModelSettingJson (模型设置)
```typescript
class CubismModelSettingJson {
  constructor(buffer: ArrayBuffer, size: number)
  getModelFileName(): string
  getTextureCount(): number
  getTextureFileName(index: number): string
  getMotionGroupCount(): number
  getMotionGroupName(index: number): string
  getMotionCount(groupName: string): number
  getMotionFileName(groupName: string, index: number): string
  getExpressionCount(): number
  getExpressionFileName(index: number): string
  getPhysicsFileName(): string
  getPoseFileName(): string
  getLayoutMap(map: csmMap<string, number>): void
  getLipSyncParameterCount(): number
  getLipSyncParameterId(index: number): CubismIdHandle
}
```

#### 4. CubismRenderer_WebGL (渲染器)
```typescript
class CubismRenderer_WebGL {
  startUp(gl: WebGLRenderingContext): void
  initialize(width: number, height: number): void
  resize(width: number, height: number): void
  loadShaders(): void
  setMvpMatrix(matrix: CubismMatrix44): void
  drawModel(): void
  bindTexture(index: number, texture: WebGLTexture): void
  setIsPremultipliedAlpha(premultiplied: boolean): void
}
```

#### 5. CubismMotionManager (动作管理器)
```typescript
class CubismMotionManager {
  addMotion(groupName: string, motion: CubismMotion): void
  startMotion(motion: CubismMotion, priority: number): boolean
  updateMotion(model: CubismModel, deltaTime: number): boolean
  isFinished(): boolean
  getMotion(groupName: string, index: number): CubismMotion
  stopAllMotions(): void
}
```

#### 6. CubismExpressionMotionManager (表情管理器)
```typescript
class CubismExpressionMotionManager {
  addMotion(motion: CubismExpressionMotion): void
  updateMotion(model: CubismModel, deltaTime: number): void
  getCurrentExpression(): number
  setExpression(expressionNo: number): void
}
```

#### 7. CubismEyeBlink (眼睛眨动)
```typescript
class CubismEyeBlink {
  constructor(modelSetting: ICubismModelSetting)
  updateParameters(model: CubismModel, deltaTimeSeconds: number): void
  setBlinkingInterval(blinkingInterval: number): void
  setBlinkingSetting(closing, closed, opening: number): void
}
```

#### 8. CubismBreath (呼吸效果)
```typescript
class CubismBreath {
  static create(): CubismBreath
  setParameters(parameters: csmVector<BreathParameterData>): void
  updateParameters(model: CubismModel, deltaTimeSeconds: number): void
}
```

#### 9. CubismPhysics (物理演算)
```typescript
class CubismPhysics {
  static create(buffer: ArrayBuffer, size: number): CubismPhysics
  evaluate(model: CubismModel, deltaTimeSeconds: number): void
  setGravity(gravity: Physics.Vector2): void
  setWind(wind: Physics.Vector2): void
}
```

#### 10. CubismPose (姿势系统)
```typescript
class CubismPose {
  static create(buffer: ArrayBuffer, size: number): CubismPose
  updateParameters(model: CubismModel, deltaTimeSeconds: number): void
  setFadeIn(fadeInTime: number): void
  setFadeOut(fadeOutTime: number): void
}
```

#### 11. CubismMotion (动作)
```typescript
class CubismMotion {
  static create(buffer: ArrayBuffer, size: number): CubismMotion
  setFinishedMotionHandler(handler: () => void): void
  updateParameters(model: CubismModel, userTimeSeconds: number, fadeWeight: number): void
  isFinished(): boolean
  getDuration(): number
  getLoopDuration(): number
  setFadeIn(fadeInTime: number): void
  setFadeOut(fadeOutTime: number): void
}
```

#### 12. CubismExpressionMotion (表情动作)
```typescript
class CubismExpressionMotion {
  static loadJson(buffer: ArrayBuffer, size: number): CubismExpressionMotion
  updateParameters(model: CubismModel, userTimeSeconds: number, weight: number): void
}
```

#### 13. CubismMatrix44 (矩阵)
```typescript
class CubismMatrix44 {
  constructor()
  setMatrix(matrix: Float32Array): void
  getArray(): Float32Array
  identity(): void
  scale(scaleX: number, scaleY: number): void
  translateX(x: number): void
  translateY(y: number): void
  translate(x: number, y: number): void
  multiplyByMatrix(m: CubismMatrix44): void
  multiplyByMatrix2(a: CubismMatrix44, b: CubismMatrix44): void
  toJson(): any
  fromJson(json: any): void
}
```

#### 14. CubismTargetPoint (注视点)
```typescript
class CubismTargetPoint {
  constructor()
  update(deltaTimeSeconds: number): void
  getX(): number
  getY(): number
  set(x: number, y: number): void
}
```

#### 15. CubismModel (模型)
```typescript
class CubismModel {
  constructor(buffer: ArrayBuffer)
  update(): void
  getParameterCount(): number
  getParameterIndex(id: string): number
  getParameterValueById(id: string): number
  setParameterValueById(id: string, value: number, weight?: number): void
  addParameterValueById(id: string, value: number, weight?: number): void
  getDrawableCount(): number
  getDrawableIndex(drawableId: string): number
  getDrawableVertices(drawableIndex: number): Float32Array
  getCanvasWidth(): number
  getCanvasHeight(): number
  getPartCount(): number
  getPartIndex(partId: string): number
  getPartOpacityByIndex(partIndex: number): number
  setPartOpacityByIndex(partIndex: number, opacity: number): void
}
```

#### 16. CubismIdHandle (ID 句柄)
```typescript
type CubismIdHandle = string
```

#### 17. csmVector (向量)
```typescript
class csmVector<T> {
  constructor(initialCapacity?: number)
  pushBack(value: T): void
  clear(): void
  getSize(): number
  at(index: number): T
  set(index: number, value: T): void
  remove(index: number): void
  resize(newSize: number, value: T): void
}
```

#### 18. csmMap (映射)
```typescript
class csmMap<K, V> {
  constructor()
  isExist(key: K): boolean
  getValue(key: K): V
  setValue(key: K, value: V): void
  remove(key: K): void
  clear(): void
  getSize(): number
}
```

---

## 四、CubismModel.ts 完整实现

### 需要实现的方法

#### 基础方法
- `constructor()`
- `static from(modelPath: string): Promise<CubismModel>`
- `load(modelPath: string): Promise<void>`
- `initWebGL(canvas: HTMLCanvasElement, initialPosition?: Position): void`
- `update(): void`
- `render(): void`
- `resize(width: number, height: number): void`
- `destroy(): void`
- `static destroyGlobal(): void`

#### 交互方法
- `focus(x: number, y: number): void`
- `motion(group: string, index: number, priority?: number): void`
- `expression(expressionId: string | number): void`
- `startRandomMotion(groupName: string, priority: number): void`

#### 口型同步方法
- `startLipSync(audioElement: HTMLAudioElement): void`
- `stopLipSync(): void`

#### 信息获取方法
- `getModelInfo(): CubismModelInfo`
- `getModelBounds(): ModelBounds | null`
- `getTextureSource(): HTMLImageElement | null`
- `isPointInModel(x: number, y: number): boolean`
- `getState(): LoadStep`
- `getTextureCount(): number`

---

## 五、实现顺序

### 阶段 1：核心类实现 (1-2天)
1. CubismMatrix44 - 矩阵运算
2. CubismIdHandle - ID 句柄
3. csmVector - 向量容器
4. csmMap - 映射容器
5. CubismModel - 模型数据结构

### 阶段 2：模型加载与渲染 (2-3天)
1. CubismModelSettingJson - 模型设置解析
2. CubismUserModel - 用户模型
3. CubismRenderer_WebGL - 渲染器
4. CubismFramework - 框架初始化

### 阶段 3：动画系统 (2-3天)
1. CubismMotion - 动作
2. CubismExpressionMotion - 表情动作
3. CubismMotionManager - 动作管理器
4. CubismExpressionMotionManager - 表情管理器
5. CubismTargetPoint - 注视点

### 阶段 4：效果系统 (1-2天)
1. CubismEyeBlink - 眼睛眨动
2. CubismBreath - 呼吸效果
3. CubismPhysics - 物理演算
4. CubismPose - 姿势系统

### 阶段 5：集成测试 (1-2天)
1. CubismModel.ts 完整实现
2. 单元测试补全
3. 类型检查修复
4. 集成测试

---

## 六、测试策略

### 单元测试覆盖
- [ ] CubismModel 构造与加载
- [ ] CubismModel WebGL 初始化
- [ ] CubismModel 动作播放
- [ ] CubismModel 表情切换
- [ ] CubismModel 口型同步
- [ ] CubismModel 眼睛注视
- [ ] CubismModel 模型信息获取
- [ ] CubismModel 纹理获取
- [ ] CubismModel 位置和边界
- [ ] CubismModel 状态管理
- [ ] CubismModel 资源释放

### 集成测试
- [ ] Canvas.vue 与 CubismModel 集成
- [ ] PerformanceQueue 与 CubismModel 集成
- [ ] 口型同步与音频集成
- [ ] 模型切换和位置保存
- [ ] 多模型并行加载

---

## 七、风险与缓解

### 技术风险
1. **Cubism SDK API 不熟悉**：参考官方示例和文档
2. **WebGL 渲染复杂**：先实现基础渲染，再优化
3. **口型同步兼容性**：保持现有 Web Audio API 实现
4. **性能问题**：使用性能分析工具优化

### 缓解措施
1. 参考 Live2D 官方 CubismWebSamples
2. 分阶段实现，每阶段测试
3. 保持与 pixi-live2d-display 的 API 兼容
4. 使用性能监控工具

---

## 八、成功标准

### 功能完整性
- [ ] 所有 16 个核心功能正常工作
- [ ] 所有 6 个前端交互功能正常工作
- [ ] 所有 6 个状态管理功能正常工作
- [ ] 所有 3 个表演系统功能正常工作

### 代码质量
- [ ] TypeScript 类型检查通过
- [ ] 单元测试覆盖率 > 80%
- [ ] 无内存泄漏
- [ ] 性能达到预期

### 兼容性
- [ ] 与现有 Canvas.vue 集成正常
- [ ] 与 PerformanceQueue 集成正常
- [ ] 支持所有 Cubism 4 模型格式
- [ ] 跨平台兼容（Windows/macOS/Linux）
