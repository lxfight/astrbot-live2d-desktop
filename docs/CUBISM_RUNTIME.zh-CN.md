# Cubism Runtime 说明

本文档描述当前仓库中 Live2D Cubism 的**实际接入方式**，用于替代已经过时的迁移草案。

## 当前基线

- 渲染方案：**官方 Cubism SDK for Web**
- 当前基线：`5-r.4`
- Core 来源：运行时通过 `cubism://core/live2dcubismcore.min.js` 加载官方 Core 文件
- Framework 来源：安装阶段从官方仓库拉取固定版本，生成到 `.generated/cubism-framework/`

## 关键约束

- **官方 SDK 源码不进入 `src/` 目录**
- `.generated/cubism-framework/` 是构建生成目录，不提交到仓库
- `public/lib/live2dcubismcore.min.js` 是运行时 Core 文件，不是源码目录中的 framework 副本

## 运行流程

### 开发/安装阶段

执行 `pnpm install` 时会完成以下动作：

1. 重建 Electron 原生依赖
2. 下载官方 Cubism Core 到 `public/lib/`
3. 拉取固定版本的 `CubismWebFramework`
4. 生成 framework 到 `.generated/cubism-framework/`
5. 对 framework 应用本地补丁

相关脚本：

- `scripts/cubism-config.js`
- `scripts/download-cubism-core.js`
- `scripts/download-framework.js`
- `scripts/apply-cubism-framework-patches.mjs`

### 应用运行阶段

1. Electron 注册 `cubism://` 协议
2. 渲染进程通过多入口页面（`main.html` 等）按需预加载 Core
3. `src/utils/cubism/CubismModel.ts` 通过 `@cubism-framework` 使用生成后的官方 framework
4. 模型按 `.model3.json` → `.moc3` → 纹理 → motion/expression/physics/pose 的顺序加载

## 当前实现范围

当前分支已经覆盖：

- `.model3.json` 模型加载
- 动作 / 表情 / 口型同步
- physics / pose / hit-test
- 拖拽、位置保存与窗口穿透协作
- Electron 导入模型资源校验

## 已移除内容

以下旧方案已不再作为运行时主链：

- `pixi-live2d-display`
- `pixi.js`
- `src/utils/Live2DModel.ts`
- `src/framework/` 中的 vendored framework 副本

## 验证命令

提交前至少应通过：

```bash
pnpm test
pnpm run typecheck
pnpm run build:prepare
```

## 相关文件

- `package.json`
- `electron/utils/downloadCubismCore.ts`
- `electron/ipc/model.ts`
- `src/components/Live2D/Canvas.vue`
- `src/utils/cubism/CubismModel.ts`
- `tsconfig.json`
- `vite.config.ts`
