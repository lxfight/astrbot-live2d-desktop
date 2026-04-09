# 桌面行为架构（置顶/穿透/显示）

## 1. 设计目标

- 消除多模块直接调用 `BrowserWindow` 带来的状态覆盖问题。
- 将“用户偏好”“运行时事件”“窗口最终行为”分层，避免状态耦合。
- 保证后续新增窗口策略时只改一个主流程入口。

## 2. 单一状态拥有者

主进程 `DesktopBehaviorCoordinator` 是唯一允许调用窗口行为 API 的模块。

- 协调器路径：`electron/desktopBehavior/coordinator.ts`
- 状态计算路径：`electron/desktopBehavior/store.ts`
- 持久化路径：`electron/desktopBehavior/repository.ts`
- IPC 契约路径：`electron/ipc/desktopBehavior.ts`

除协调器外，其他模块只能发送语义事件，禁止直接调用：

- `setAlwaysOnTop`
- `setIgnoreMouseEvents`
- `setSize` / `setPosition`（桌面行为相关）
- `show` / `showInactive` / `focus`（桌面行为相关）

## 3. 三层状态模型

### Preferences（持久化）

存储于 `userConfig`：

- `alwaysOnTop`
- `fullPassThrough`
- `dynamicPassThrough`
- `autoDetectFullscreen`

### Runtime（运行时）

只存在于内存：

- `modelReady`：Live2D 模型是否已成功加载
- `backgroundPaused`：锁屏/挂起等后台暂停
- `gameModeHidden`：全屏应用期间隐藏

### Effective（最终行为）

由 `Preferences + Runtime + PlatformCapabilities` 纯计算得到：

- `visible`
- `alwaysOnTop`
- `zOrderLevel`

## 4. 事件入口与数据流

统一入口 IPC：

- `desktopBehavior:getPreferences`
- `desktopBehavior:updatePreferences`
- `desktopBehavior:getSnapshot`
- `desktopBehavior:setMousePassthrough`
- `desktopBehavior:setModelReady`
- `desktopBehavior:requestReveal`

处理流程固定：

1. IPC 入参校验（主进程）
2. 协调器更新 Runtime/Preferences
3. `store.computeDesktopBehaviorEffectiveState` 计算新状态
4. 协调器按差异应用到主窗口
5. 广播 `desktopBehavior:snapshotChanged`
6. 渲染进程订阅快照并更新 UI

## 5. 关键行为策略

- 全屏检测触发隐藏时：仅改变运行态，不允许外围模块直接 `show/hide` 主窗口。
- 无模型时：主窗口保持隐藏，通过设置窗口（模型库）承载导入流程。
- `requestReveal` 仅保留两种策略：手动/托盘唤起时聚焦前置，其他场景仅 `showInactive`。
- 鼠标穿透由独立通道控制，不参与 `visible/alwaysOnTop` 的计算与决策。

## 6. 维护约束

- 新增桌面行为开关时，必须同步修改：
  - `src/utils/desktopFeatureSettings.ts`
  - `electron/desktopBehavior/repository.ts`
  - `electron/desktopBehavior/store.ts`
  - `src/types/electron.d.ts`（如涉及 IPC 类型）
- 任何窗口层级行为改动，必须通过协调器落地，不得在业务模块直接操作主窗口。
- 渲染进程只表达“意图”，不直接调用窗口 API。

## 7. 回归检查清单

1. 托盘点击“显示主窗口”在有模型时应聚焦前置；无模型时应打开模型库页。
2. 打开设置/历史窗口后主窗口不再压住前景应用。
3. 空态导入与恢复模型时，尺寸与置顶联动正确。
4. 全屏应用进入/退出后，主窗口隐藏/恢复正确。
