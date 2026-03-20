# Live2D Cubism SDK 迁移计划

## 项目概述

**项目名称**: astrbot-live2d-desktop  
**当前技术栈**: PixiJS v7.4.3 + pixi-live2d-display v0.4.0  
**目标技术栈**: 官方 Cubism SDK for Web (Cubism 5.3)  
**分支名称**: feature/cubism-sdk-migration  

## 迁移目标

将 Live2D 渲染引擎从第三方封装库 (pixi-live2d-display) 迁移到官方 Cubism SDK，以获得：
- 更好的维护性和官方支持
- 完整的 Cubism 5.3 功能支持
- 更精细的性能控制
- 更低的第三方依赖风险

## 当前功能清单

### 核心功能（必须保留）
1. **模型加载** - 支持 .model3.json 格式
2. **口型同步** - 基于音频分析的实时口型动画
3. **动作播放** - 支持多个动作组和优先级
4. **表情切换** - 支持多种表情预设
5. **眼睛注视** - 模型眼睛跟随鼠标位置
6. **模型拖拽** - 拖拽移动模型位置
7. **位置保存** - 保存和恢复模型位置

### 特殊功能（需要适配）
1. **窗口穿透** - Electron 窗口点击穿透
2. **动态穿透** - 根据鼠标位置动态切换穿透状态
3. **UI 交互** - 气泡菜单、设置面板等

### 技术功能（需要重写）
1. **WebGL 渲染** - 从 PixiJS WebGL 迁移到原生 WebGL
2. **模型信息获取** - 获取动作组、表情列表等
3. **纹理加载** - 处理模型纹理的加载和绑定
4. **更新循环** - 实现模型更新和渲染循环

## 迁移时间线

### 第一阶段：准备工作（1-2天）
- [ ] 1.1 创建迁移分支
- [ ] 1.2 分析当前代码结构
- [ ] 1.3 研究官方 SDK API
- [ ] 1.4 设计新的架构

### 第二阶段：核心实现（3-5天）
- [ ] 2.1 创建 CubismModel 基础类
- [ ] 2.2 实现 WebGL 渲染器
- [ ] 2.3 实现模型加载逻辑
- [ ] 2.4 实现动作和表情系统

### 第三阶段：功能迁移（2-3天）
- [ ] 3.1 迁移口型同步功能
- [ ] 3.2 迁移眼睛注视功能
- [ ] 3.3 迁移模型拖拽功能
- [ ] 3.4 迁移位置保存功能

### 第四阶段：集成测试（1-2天）
- [ ] 4.1 替换现有的 Live2DModel 类
- [ ] 4.2 更新 Canvas.vue 组件
- [ ] 4.3 集成测试
- [ ] 4.4 性能优化

### 第五阶段：清理和优化（1天）
- [ ] 5.1 移除 PixiJS 相关依赖
- [ ] 5.2 清理未使用的代码
- [ ] 5.3 更新文档
- [ ] 5.4 最终测试

## 技术架构设计

### 新架构概览
```
┌─────────────────────────────────────────┐
│           Vue3 Components               │
│  ┌─────────────────────────────────┐  │
│  │        Canvas.vue               │  │
│  │  - 渲染循环管理                  │  │
│  │  - 鼠标事件处理                  │  │
│  │  - 窗口穿透控制                  │  │
│  └─────────────────────────────────┘  │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│           CubismModel Class             │
│  ┌─────────────────────────────────┐  │
│  │  - 模型加载和管理                │  │
│  │  - 动作和表情控制                │  │
│  │  - 口型同步处理                  │  │
│  │  - 眼睛注视控制                  │  │
│  └─────────────────────────────────┘  │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│       Cubism SDK for Web                │
│  ┌─────────────────────────────────┐  │
│  │  - CubismUserModel              │  │
│  │  - CubismRenderer_WebGL         │  │
│  │  - CubismMotionManager          │  │
│  │  - CubismExpressionMotionManager│  │
│  └─────────────────────────────────┘  │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│          WebGL Canvas                   │
│  ┌─────────────────────────────────┐  │
│  │  - 原生 WebGL 渲染               │  │
│  │  - 模型绘制                      │  │
│  │  - 纹理绑定                      │  │
│  └─────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### 核心类设计

#### 1. CubismModel 类
```typescript
export class CubismModel {
  private userModel: CubismUserModel | null = null;
  private renderer: CubismRenderer_WebGL | null = null;
  private motionManager: CubismMotionManager | null = null;
  private expressionManager: CubismExpressionMotionManager | null = null;
  private eyeBlink: CubismEyeBlink | null = null;
  private breath: CubismBreath | null = null;
  private physics: CubismPhysics | null = null;
  private pose: CubismPose | null = null;
  private wavFileHandler: LAppWavFileHandler | null = null;
  
  // 核心方法
  async load(modelPath: string): Promise<void>;
  initWebGL(canvas: HTMLCanvasElement): void;
  update(deltaTime: number): void;
  render(): void;
  
  // 功能方法
  motion(group: string, index: number, priority: number): void;
  expression(expressionId: string): void;
  focus(x: number, y: number): void;
  startLipSync(audioElement: HTMLAudioElement): void;
  stopLipSync(): void;
  
  // 信息获取
  getModelInfo(): ModelInfo;
  getModelBounds(): ModelBounds;
}
```

#### 2. CubismRenderer 类
```typescript
export class CubismRenderer {
  private gl: WebGLRenderingContext | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private shaderManager: CubismShader_WebGL | null = null;
  
  initialize(canvas: HTMLCanvasElement): void;
  bindTexture(textureId: number, texture: WebGLTexture): void;
  drawModel(): void;
  resize(width: number, height: number): void;
}
```

## 文件变更清单

### 新增文件
1. `src/utils/cubism/CubismModel.ts` - 主模型类
2. `src/utils/cubism/CubismRenderer.ts` - 渲染器类
3. `src/utils/cubism/CubismMotionManager.ts` - 动作管理器
4. `src/utils/cubism/CubismExpressionManager.ts` - 表情管理器
5. `src/utils/cubism/LAppWavFileHandler.ts` - 口型同步处理
6. `src/utils/cubism/CubismAllocator.ts` - 内存分配器
7. `src/utils/cubism/constants.ts` - 常量定义

### 修改文件
1. `src/components/Live2D/Canvas.vue` - 更新为使用新的 CubismModel
2. `src/utils/Live2DModel.ts` - 完全重写
3. `package.json` - 更新依赖
4. `vite.config.ts` - 更新构建配置

### 删除文件
1. 无（保留现有文件作为备份）

## 依赖变更

### 移除的依赖
```json
{
  "pixi.js": "^7.4.3",
  "pixi-live2d-display": "^0.4.0"
}
```

### 新增的依赖
```json
{
  "live2dcubismcore": "latest"
}
```

### 保留的依赖
- Vue3 相关依赖
- Electron 相关依赖
- 其他功能依赖

## 风险评估

### 技术风险
1. **WebGL 兼容性** - 官方 SDK 仅支持 WebGL，可能需要处理 WebGL 不可用的情况
2. **性能差异** - 原生 WebGL 可能需要更多的性能优化工作
3. **功能缺失** - 需要确保所有现有功能都能在新架构中实现

### 时间风险
1. **学习曲线** - 官方 SDK API 较复杂，需要时间学习
2. **调试困难** - WebGL 调试可能比 PixiJS 更困难
3. **集成问题** - 与现有 Electron 环境的集成可能存在未知问题

### 缓解措施
1. **分阶段实施** - 按阶段进行，每阶段完成后测试
2. **并行开发** - 保持现有功能可用，新功能逐步替换
3. **充分测试** - 每个功能点都要进行充分测试
4. **文档完善** - 详细记录每个决策和实现细节

## 测试计划

### 单元测试
1. 模型加载测试
2. 动作播放测试
3. 表情切换测试
4. 口型同步测试
5. 眼睛注视测试

### 集成测试
1. Canvas.vue 集成测试
2. 窗口穿透功能测试
3. UI 交互测试
4. 性能基准测试

### 回归测试
1. 与现有功能对比测试
2. 多模型兼容性测试
3. 长时间运行稳定性测试

## 部署计划

### 开发环境
1. 在 `feature/cubism-sdk-migration` 分支上开发
2. 使用开发模式进行实时测试
3. 定期提交代码，保持版本控制

### 测试环境
1. 创建 `beta/cubism-sdk-migration` 分支
2. 进行完整的功能测试
3. 邀请用户进行试用

### 生产环境
1. 测试通过后合并到 `develop` 分支
2. 进行最终的集成测试
3. 合并到 `master` 分支并发布

## 回滚计划

如果迁移过程中遇到无法解决的问题，可以使用以下回滚策略：

1. **代码回滚**：直接删除 `feature/cubism-sdk-migration` 分支
2. **功能回滚**：保留现有 pixi-live2d-display 代码，新代码作为实验性功能
3. **渐进回滚**：逐步替换功能点，每个功能点独立可回滚

## 沟通计划

### 内部沟通
1. 每日进度更新
2. 每周技术决策会议
3. 代码审查和设计讨论

### 外部沟通（如果有用户）
1. 迁移开始公告
2. 测试版本发布通知
3. 最终完成公告

## 成功标准

### 功能完整性
- [ ] 所有现有功能都能正常工作
- [ ] 新功能按预期实现
- [ ] 无回归问题

### 性能指标
- [ ] 渲染性能不降低
- [ ] 内存使用不增加
- [ ] 启动时间不增加

### 代码质量
- [ ] 代码结构清晰
- [ ] 有完整的注释和文档
- [ ] 通过所有测试

## 后续优化

迁移完成后，可以进一步优化：

1. **性能优化** - 使用 WebGL 2.0 或 WebGPU
2. **功能增强** - 添加官方 SDK 的高级功能
3. **工具开发** - 创建模型编辑和调试工具
4. **文档完善** - 创建详细的开发文档

---

**计划制定日期**: 2026-03-20  
**预计完成时间**: 8-12 天  
**负责人**: 项目维护者  

## 迁移进度记录

### 2026-03-20 - 迁移开始
- [x] 完成项目分析和迁移计划制定
- [x] 创建迁移分支 `feature/cubism-sdk-migration`
- [x] 创建 Cubism SDK 基础目录结构
- [x] 创建 CubismModel 基础类框架
- [x] 创建 CubismAllocator 内存分配器
- [x] 创建 constants.ts 常量定义
- [x] 创建 index.ts 模块导出
- [x] 更新 package.json 添加 live2dcubismcore 依赖

**下一步计划**:
1. 实现 CubismModel 的模型加载功能
2. 实现 WebGL 渲染器基础
3. 测试基本的模型渲染
4. 替换现有的 Live2DModel 类

### 技术决策记录

#### 2026-03-20 14:30
**决策**: 选择保留现有的 PixiJS 渲染作为 WebGL 上下文提供者，逐步迁移到原生 WebGL  
**理由**: 
- Electron 环境中 WebGL 上下文可能需要特殊处理
- 渐进式迁移可以保持现有功能可用
- 可以复用 PixiJS 的 WebGL 上下文管理

**替代方案**: 
- 直接使用原生 WebGL（风险较高）
- 使用其他 WebGL 库如 Three.js（引入新的复杂性）

#### 2026-03-20 14:35
**决策**: 使用 live2dcubismcore npm 包作为 Cubism SDK 运行时  
**理由**: 
- 官方推荐的 npm 包
- 自动处理版本更新
- 与项目构建系统集成良好

**替代方案**:
- 手动下载 Cubism Core 文件（维护成本高）
- 使用 CDN 引入（网络依赖）