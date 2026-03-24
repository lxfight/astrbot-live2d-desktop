# Live2D Cubism SDK 迁移状态

> [!WARNING]
> 本文档为历史状态记录，内容已过时。
> 当前代码已迁移到 **官方 Cubism SDK for Web 5-r.4** 基线，并移除了旧 `pixi-live2d-display` 运行时与相关依赖。
> 以当前代码与验证结果（`pnpm test` / `pnpm run typecheck` / `pnpm run build:prepare`）为准。

## 当前状态：🟡 历史记录（已过时）

迁移工作正在进行中，基础架构已经搭建完成。

## 已完成的工作

### ✅ 基础架构
- [x] 创建迁移分支 `feature/cubism-sdk-migration`
- [x] 创建 Cubism SDK 基础目录结构 (`src/utils/cubism/`)
- [x] 创建 `CubismModel` 基础类框架
- [x] 创建 `CubismAllocator` 内存分配器
- [x] 创建 `constants.ts` 常量定义
- [x] 创建 `index.ts` 模块导出
- [x] 更新 `package.json` 添加 `live2dcubismcore` 依赖
- [x] 创建 `CubismModel.test.ts` 测试文件
- [x] 创建详细的迁移计划文档

### 📁 文件结构
```
src/utils/cubism/
├── CubismModel.ts          # 主模型类（基础框架）
├── CubismAllocator.ts      # 内存分配器
├── constants.ts            # 常量定义
├── index.ts                # 模块导出
└── CubismModel.test.ts     # 测试文件
```

## 下一步工作

### 🚧 即将开始
1. **实现模型加载功能**
   - 实现 `load()` 方法
   - 加载 model3.json 配置文件
   - 加载 moc3 模型文件
   - 加载纹理文件

2. **实现 WebGL 渲染器**
   - 创建 CubismRenderer 类
   - 实现 WebGL 上下文初始化
   - 实现着色器管理
   - 实现纹理绑定

3. **集成 Cubism SDK**
   - 导入真实的 Cubism SDK 类型
   - 初始化 CubismFramework
   - 创建 CubismUserModel 实例

### ⏳ 后续阶段
4. **功能迁移**
   - 口型同步功能
   - 眼睛注视功能
   - 动作播放功能
   - 表情切换功能

5. **集成测试**
   - 替换现有的 Live2DModel 类
   - 更新 Canvas.vue 组件
   - 功能回归测试

## 技术决策

### 当前决策
- 使用 `live2dcubismcore` npm 包作为 Cubism SDK 运行时
- 创建新的 CubismModel 类，而不是直接修改现有 Live2DModel
- 使用渐进式迁移，保持现有功能可用

### 待解决问题
1. **WebGL 上下文管理**
   - 是使用原生 WebGL 还是继续使用 PixiJS 的 WebGL 上下文？
   - 如何处理 WebGL 不可用的情况？

2. **性能优化**
   - 如何优化 WebGL 渲染性能？
   - 如何处理多个模型同时渲染？

3. **兼容性**
   - 如何确保与现有 Electron 环境的兼容性？
   - 如何处理不同版本的 Cubism 模型？

## 如何测试

### 运行测试
```bash
# 安装依赖
pnpm install

# 运行测试
pnpm test

# 运行类型检查
pnpm typecheck
```

### 开发模式
```bash
# 启动开发服务器
pnpm dev
```

## 贡献指南

### 代码规范
- 使用 TypeScript 严格模式
- 遵循现有项目的代码风格
- 为所有公共方法添加 JSDoc 注释
- 编写单元测试

### 提交规范
- 提交信息使用中文
- 格式：`[Cubism迁移] 描述`
- 示例：`[Cubism迁移] 实现模型加载功能`

## 相关文档

- [迁移计划](./docs/migration-plan.md)
- [官方 Cubism SDK 文档](https://docs.live2d.com/cubism-sdk-manual/top/)
- [Cubism Web Samples](https://github.com/Live2D/CubismWebSamples)

## 联系方式

如有问题或建议，请通过以下方式联系：
- 创建 Issue
- 提交 Pull Request
- 项目内部沟通

---

**最后更新**: 2026-03-20  
**迁移分支**: `feature/cubism-sdk-migration`  
**预计完成时间**: 8-12 天
