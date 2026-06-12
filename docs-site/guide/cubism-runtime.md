# Cubism Runtime

本文档描述当前仓库中 Live2D Cubism 的实际接入方式，用于替代已经过时的迁移草案。

## 当前基线

- 渲染方案：官方 Cubism SDK for Web。
- 当前基线：`5-r.4`。
- Core 来源：运行时通过 `cubism://core/live2dcubismcore.min.js` 加载官方 Core 文件。
- Framework 来源：安装阶段从官方仓库拉取固定版本，生成到 `.generated/cubism-framework/`。

## 关键约束

- 官方 SDK 源码不进入 `src/` 目录。
- `.generated/cubism-framework/` 是构建生成目录，不提交到仓库。
- `public/lib/live2dcubismcore.min.js` 是运行时 Core 文件，不是源码目录中的 framework 副本。

## 运行流程

### 开发/安装阶段

执行 `pnpm install` 时会完成以下动作：

1. 重建 Electron 原生依赖。
2. 下载官方 Cubism Core 到 `public/lib/`。
3. 拉取固定版本的 `CubismWebFramework`。
4. 生成 framework 到 `.generated/cubism-framework/`。
5. 对 framework 应用本地补丁。

相关脚本：

- `scripts/cubism-config.js`
- `scripts/download-cubism-core.js`
- `scripts/download-framework.js`
- `scripts/apply-cubism-framework-patches.mjs`

### 应用运行阶段

1. Electron 注册 `cubism://` 协议。
2. 渲染进程通过多入口页面（`main.html` 等）按需预加载 Core。
3. `src/utils/cubism/CubismModel.ts` 通过 `@cubism-framework` 使用生成后的官方 framework。
4. 模型主数据按 `.model3.json` -> `.moc3` -> expression -> physics -> pose -> motion 的顺序加载，纹理在 WebGL 初始化后单独加载。

## 当前实现范围

当前分支已经覆盖：

- `.model3.json` 模型加载。
- 动作、表情、口型同步。
- physics、pose、hit-test。
- 拖拽、位置保存与窗口穿透协作。
- Electron 导入模型资源校验。

## 模型支持边界

- 当前桌面端只支持 Cubism 3/4 的 `.model3.json` 模型入口。
- 不支持 Cubism 2 `.model.json`，导入阶段会直接拒绝。
- “支持 Cubism 3/4” 指的是支持该时代的 `.model3.json` 资源结构，不表示兼容 Cubism 2 的旧模型链。

## 动作与表情发现顺序

模型动作与表情不是只从 `.model3.json` 单一路径获取。当前实现按下面的顺序整合声明：

1. 标准声明：读取 `.model3.json` 内 `FileReferences.Expressions` 与 `FileReferences.Motions`。
2. companion 声明：读取模型目录中的 `.vtube.json`。
3. 目录扫描 fallback：递归扫描模型目录内的 `.exp3.json` 与 `.motion3.json`。

发现结果会聚合成一份兼容清单，并记录来源：

- `model3`：来自 `.model3.json` 标准声明。
- `companion`：来自 `.vtube.json`。
- `scan`：来自目录扫描 fallback。

当只有标准声明时，发现模式是 `standard`；当标准声明与兼容来源混用时是 `hybrid`；当主要依赖 companion 或扫描时是 `compatibility`。

## `.vtube.json` companion 的范围

当前实现只把 `.vtube.json` 当作 companion 兼容层，不是完整的 VTube Studio 配置解释器。

已消费的内容只有这些：

- `FileReferences.IdleAnimation`
- `FileReferences.IdleAnimationWhenTrackingLost`
- `Hotkeys` 中能映射到 `.exp3.json` 或 `.motion3.json` 的条目

这意味着：

- companion 可以补出待机动作、`IdleTrackingLost` 动作组，以及部分热键对应的表情/动作。
- 当前桌面端只会把 `IdleAnimationWhenTrackingLost` 发现为 `IdleTrackingLost` 动作组，暂未实现“追踪丢失状态自动切换”。
- companion 不能替代 `.model3.json` 主清单，也不保证完整保留第三方工具中的原始语义。

## 目录扫描 fallback 的范围

目录扫描是兼容补全，不是标准链路。当前实现会递归扫描模型目录，并自动收集：

- `.exp3.json` 表情文件。
- `.motion3.json` 动作文件。

其特点和限制：

- 它会把扫描到的表情和动作补入兼容清单。
- 同名候选可能触发择优逻辑，例如优先更浅层目录、特定目录结构或文件名匹配。
- 发现冲突或声明缺失时，会在兼容信息中记录 warning。
- 扫描补出来的结果更适合作为“尽量可用”的 fallback，不适合作为唯一的精确语义来源。

## `astrbot.live2d.profile.json`

如果模型目录存在 `astrbot.live2d.profile.json`，运行时会自动尝试加载；如果文件不存在、读取失败或内容无效，则直接跳过这层语义增强。

它不是模型主配置，而是表情语义增强层，当前只承载这些信息：

- `aliases`：为表情目录增补可解析别名。
- `tags`：为表情 ID 显式指定语义标签。
- `semanticPresets`：为语义标签预设候选表情。

当前行为要点：

- profile 会在表情文件加载后参与 `expressionCatalog` 与 `semanticPresets` 构建，并把别名补入运行时可解析表情条目。
- profile 存在时，`expressionProfile` 能力会被标记为可用。
- profile 缺失不会阻塞模型加载，只会减少语义层信息。

## `exp3` / `combo` / `semantic`

### `exp3`

- 当前表情目录与参数化能力以 `.exp3.json` 解析结果为基础。
- 只有成功解析且包含有效参数的表情文件，才会参与 `combo` / `semantic` 等参数化能力构建。
- 解析失败或没有有效参数的文件，若原生表情加载成功，仍可能以单表情回退方式可用。

### `combo`

- 运行时支持一次请求中同时指定多个表情，并按权重叠加。
- 组合能力建立在已解析的 `.exp3.json` 参数集之上，不是简单文件并列播放。
- 如果多个表情命中同一冲突组，运行时会做冲突收敛；因此 `combo` 是受约束的多表情组合，不是无限制混合。

### `semantic`

- 运行时支持按语义标签选择表情，如 `happy`、`sad`、`angry`、`surprised`、`thinking`、`neutral`、`speaking`。
- 这些标签一部分来自 `astrbot.live2d.profile.json` 的显式 `tags`，一部分来自已成功解析表情的 ID 与参数名推断。
- `semanticPresets` 可以显式指定某个标签优先映射到哪些表情 ID。

重要限制：

- 仅通过目录扫描发现的表情，默认不会自动开放推断语义标签；如果没有 profile 中的显式 `tags`，这类表情通常不会进入稳定的 `semantic` 预设。
- 因此，想让第三方模型的语义表情稳定可控，最可靠的做法仍是提供 `astrbot.live2d.profile.json`。

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

文档站单独构建时只需要：

```bash
pnpm run docs:build
```

## 相关文件

- `package.json`
- `electron/utils/downloadCubismCore.ts`
- `electron/ipc/model.ts`
- `src/components/Live2D/Canvas.vue`
- `src/utils/cubism/CubismModel.ts`
- `tsconfig.json`
- `vite.config.ts`
