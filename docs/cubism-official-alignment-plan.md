# Cubism 官方对齐实施计划

## 背景

当前 `src/utils/cubism/CubismModel.ts` 已经实现了基于官方 Cubism Framework 的模型加载与渲染雏形，但整体流程并未完整对齐官方 `CubismWebSamples` 中 `LAppModel` 的初始化顺序，因此在接入过程中出现了多类问题：moc 读取异常、motion effect ids 未设置、shader 初始化不完整、premultiplied alpha 配置缺失、render state/MVP 链路不完整等。

本次修复目标不是继续零散补丁，而是按官方 sample 的职责划分，把当前实现收敛成一条稳定、可维护、可验证的 Cubism Web 加载与渲染链。

## 目标功能清单

### 1. 模型资源加载链
- 加载 `.model3.json`
- 加载 `.moc3`
- 加载 expressions
- 加载 physics
- 加载 pose
- 预留 userdata 接入点
- 加载 motions
- 加载 textures

### 2. 模型状态初始化
- 初始化 `eyeBlinkIds`
- 初始化 `lipSyncIds`
- 初始化 breath 参数
- 为 motion 设置 `setEffectIds(eyeBlinkIds, lipSyncIds)`

### 3. 渲染器初始化
- `createRenderer(width, height)`
- `renderer.startUp(gl)`
- `renderer.setIsPremultipliedAlpha(true)`
- `renderer.loadShaders(shaderPath)`

### 4. 绘制链
- `renderer.setRenderState(frameBuffer, viewport)`
- 正确计算并设置 MVP
- `renderer.drawModel(shaderPath)`

### 5. 交互链
- 鼠标 focus
- 模型拖拽
- hit test
- 模型位置保存与恢复

### 6. 资源路径策略
- 开发环境统一从 `public/models` 读取
- 打包环境统一从 `userData/models` 读取
- 自动加载上次模型继续复用模型库路径
- 不混用外部样例目录作为运行时直接加载来源

### 7. framework 修复策略
- 优先修我们自己的接入层
- framework 例外修复仅通过 patch 机制
- 不直接提交 `src/framework/`

## 分阶段实施

### 阶段一：加载链对齐
1. 对齐 `model3.json -> moc3 -> physics -> pose -> motions -> textures` 顺序
2. 补齐 `eyeBlinkIds` 与 `lipSyncIds`
3. motion 加载后统一调用 `setEffectIds`
4. 梳理状态机，避免资源未完成就进入可渲染状态

### 阶段二：渲染链对齐
1. renderer 初始化后补齐 `loadShaders(shaderPath)`
2. 绘制前补齐 `setRenderState(frameBuffer, viewport)`
3. 修正 projection × modelMatrix 的顺序
4. 复核缩放与位置换算，避免超大 scale

### 阶段三：资源链验证
1. 验证 `public/models/<name>` 中的模型可完整加载
2. 验证设置页导入模型、模型列表、删除、重新加载
3. 验证自动加载上次模型与手动加载一致

## 关键文件
- `src/utils/cubism/CubismModel.ts`
- `src/components/Live2D/Canvas.vue`
- `electron/ipc/model.ts`
- `scripts/download-framework.js`
- `scripts/apply-cubism-framework-patches.mjs`
- `scripts/patches/*.patch`

## 验证标准

### 控制台错误清理目标
需要消除或收敛以下错误：
- `Cannot read properties of undefined/null (reading 'byteLength' / 'length')`
- `Shader program is not initialized`
- `NoPremultipliedAlpha is not allowed`
- `Shader compile log: ERROR: 0:1: '<'`

### 功能验证
- 模型可正常显示
- 动作可播放
- 可拖拽
- 可自动加载上次模型
- 设置页导入模型后可立即出现在模型库并正常加载
