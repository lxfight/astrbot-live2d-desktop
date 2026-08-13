# 插件开发指南

AstrBot Live2D 桌面端支持通过插件扩展功能。插件运行在独立的 utilityProcess 进程中，与主进程通过 RPC 通信，能力由声明式权限白名单控制。

## 快速开始

```bash
# 用脚手架生成插件骨架（在当前目录生成 <plugin-id>/）
pnpm run plugin:create weather-widget

# 编辑 manifest.json 与 index.js 后，在桌面端安装：
# 设置 → 高级 → 插件中心 → 安装插件 → 选择插件目录
```

插件是**零构建**的：一个目录包含 `manifest.json`（清单）与 `index.js`（入口），无需打包即可安装。

## 目录结构

```
weather-widget/
├── manifest.json   # 清单：id、权限、设置项 schema、事件订阅、托盘菜单
└── index.js        # 入口：module.exports = (api) => { ... }
```

## manifest.json 清单

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `id` | 是 | 插件唯一标识，须与目录名一致；小写字母/数字开头，仅含 `[a-z0-9-_]`，长度 2-64 |
| `name` | 是 | 显示名称 |
| `version` | 是 | semver 三段式，如 `1.0.0` |
| `author` | 是 | 作者 |
| `entry` | 是 | 入口文件名，不允许路径穿越 |
| `description` | 否 | 描述 |
| `minAppVersion` | 否 | 最低桌面端版本，低于则拒绝安装 |
| `permissions` | 否 | 权限白名单，默认 `["storage"]` |
| `settings` | 否 | 设置项 schema，驱动插件中心的设置表单 |
| `subscriptions` | 否 | 订阅的宿主事件 |
| `trayMenu` | 否 | 托盘菜单项（需搭配 `trayMenu` 权限） |

### 权限

| 权限 | 能力 |
| --- | --- |
| `storage` | `api.storage` 键值存储（按插件隔离，宿主保留键 `__host.*` 不可写） |
| `network` | `api.fetch`（仅 http/https，超时 10s，返回状态码与 ok） |
| `notifications` | `api.notifications.show` 系统通知 |
| `timers` | 保留权限（进程内 `setTimeout` 无需声明即可用） |
| `events` | `api.events.on` 订阅宿主事件（需 `subscriptions` 声明） |
| `trayMenu` | `api.tray.onClick` 托盘菜单点击（需 `trayMenu` 声明） |
| `settingsUi` | 保留权限（设置表单由 `settings` schema 自动渲染） |

### 设置项 schema

```json
{
  "settings": [
    { "key": "city", "kind": "text", "label": "城市", "defaultValue": "上海" },
    {
      "key": "units",
      "kind": "select",
      "label": "单位",
      "options": [
        { "label": "公制", "value": "metric" },
        { "label": "英制", "value": "imperial" }
      ],
      "defaultValue": "metric"
    },
    { "key": "notify", "kind": "boolean", "label": "通知", "defaultValue": false },
    { "key": "limit", "kind": "number", "label": "上限", "min": 0, "max": 20, "defaultValue": 3 }
  ]
}
```

支持的 kind：`text` / `number`（可配 min/max）/ `boolean` / `select` / `multiSelect`。设置值由宿主按 schema 校验后写入 `api.storage`。

### 宿主事件

订阅需同时声明 `events` 权限与 `subscriptions` 字段，否则宿主侧会静默过滤：

| 事件 | 载荷 |
| --- | --- |
| `message:received` | `{ texts: string[], sequence: unknown }` 收到 AstrBot 消息 |
| `message:sent` | `{ content: string, metadata?: unknown }` 发送消息 |
| `model:loaded` | `{ modelPath: string }` 模型加载完成 |
| `performance` | `{ messageId, duration, interrupted, sequenceCount }` 表演性能上报 |

## 入口文件

```js
/**
 * @param {import('@astrbot/plugin-sdk').HostApi} api
 */
module.exports = function main(api) {
  // 读取设置（已按 schema 合并默认值）
  api.storage.get('greeting').then(value => {
    api.log.info('问候语:', value)
  })

  // 订阅宿主事件
  api.events.on('message:received', payload => {
    api.log.info('收到消息:', payload)
  })

  // 托盘菜单
  api.tray.onClick('greet', () => {
    api.notifications.show('你好', '来自托盘')
  })

  // 返回清理钩子：宿主停用时调用（随后进程退出）
  return {
    onDisable() {
      api.log.info('清理完成')
    }
  }
}
```

### HostApi 能力一览

- `api.storage.get/set/remove/keys` — 持久化键值（插件隔离，JSON 序列化）
- `api.notifications.show(title, body?)` — 系统通知
- `api.fetch(url, { timeoutMs? })` — 受控网络请求
- `api.log.debug/info/warn/error` — 日志转发到桌面端日志文件
- `api.events.on(kind, listener)` — 宿主事件订阅
- `api.tray.onClick(menuId, listener)` — 托盘菜单点击

## 生命周期

1. **启动**：用户启用或桌面端启动时，宿主 fork utilityProcess 并加载 `entry`
2. **运行**：RPC 调用、事件推送、托盘点击均在独立进程中处理
3. **停用**：宿主先发 `disable` 命令（触发 `onDisable`），300ms 宽限期后强制结束
4. **崩溃恢复**：进程异常退出按指数退避自动重启（2s、4s、8s…，共 5 次）
5. **隔离**：连续崩溃超过 5 次后进入 `quarantined` 状态，插件中心显示崩溃次数与最近错误，需卸载重装

## SDK 类型包

`@astrbot/plugin-sdk` 提供 `HostApi`、`PluginManifest` 等类型与权限/事件白名单常量（`pnpm run build:sdk` 构建，仓库内 `packages/plugin-sdk/`）。插件源码通过 JSDoc 引用获得编辑器补全：

```js
/** @param {import('@astrbot/plugin-sdk').HostApi} api */
module.exports = function main(api) {
  api.storage.get('key') // 完整类型提示
}
```

## 安全模型

- 插件进程与主进程隔离，崩溃不影响桌面端
- 未声明的权限对应的 API 在宿主侧被拒绝（双重检查：安装校验 + 调用校验）
- 存储按 `(plugin_id, key)` 主键隔离，卸载时清空
- 网络仅 http/https，超时上限 60s

完整示例见 `examples/hello-plugin/`（存储读写、通知、事件订阅、托盘菜单）。
