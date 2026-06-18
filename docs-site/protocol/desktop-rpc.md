# 桌面感知 RPC

桌面感知 RPC 由适配器请求桌面端执行。桌面端用相同 `op` 和相同 `id` 返回结果。

::: warning
截图和窗口信息可能包含敏感内容。适配器和上层插件应只在用户授权的交互场景中使用这些能力。
:::

## `desktop.window.list`

| 项目 | 值 |
| --- | --- |
| 方向 | 适配器 -> 桌面端请求，桌面端 -> 适配器响应 |
| 用途 | 获取可截图窗口列表 |

请求：

```json
{
  "op": "desktop.window.list",
  "id": "window-list-id",
  "ts": 1781240000000
}
```

响应：

```json
{
  "op": "desktop.window.list",
  "id": "window-list-id",
  "ts": 1781240000100,
  "payload": {
    "windows": [
      {
        "id": "window:123:0",
        "title": "main.py - Visual Studio Code",
        "processName": "Code",
        "app": {
          "displayName": "VS Code",
          "canonicalKey": "vscode",
          "confidence": "high",
          "isSystem": false
        },
        "isActive": true,
        "bounds": {
          "x": 0,
          "y": 0,
          "width": 1440,
          "height": 900
        }
      }
    ]
  }
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `windows[].id` | string | 桌面端窗口 ID，可用于 `desktop.capture.screenshot.windowId`。 |
| `windows[].title` | string | 窗口标题。 |
| `windows[].processName` | string | 进程名；部分平台可能为空。 |
| `windows[].app.displayName` | string | 归一化后的应用显示名。 |
| `windows[].app.canonicalKey` | string | 稳定应用识别键，跨平台优先使用该字段匹配应用。 |
| `windows[].app.confidence` | string | 识别置信度：`high`、`medium`、`low`。 |
| `windows[].app.isSystem` | boolean | 是否被识别为系统/外壳类应用。 |
| `windows[].isActive` | boolean | 是否为活跃窗口。 |
| `windows[].bounds` | object | 窗口边界；是否可用取决于平台。 |

## `desktop.window.active`

| 项目 | 值 |
| --- | --- |
| 方向 | 适配器 -> 桌面端请求，桌面端 -> 适配器响应 |
| 用途 | 获取当前活跃窗口 |

请求：

```json
{
  "op": "desktop.window.active",
  "id": "active-window-id",
  "ts": 1781240000000
}
```

响应：

```json
{
  "op": "desktop.window.active",
  "id": "active-window-id",
  "ts": 1781240000100,
  "payload": {
    "window": {
      "id": "window:123:0",
      "title": "main.py - Visual Studio Code",
      "processName": "Code",
      "isActive": true
    }
  }
}
```

无可用窗口时，`payload.window` 为 `null`。

## `desktop.capture.screenshot`

| 项目 | 值 |
| --- | --- |
| 方向 | 适配器 -> 桌面端请求，桌面端 -> 适配器响应 |
| 用途 | 截取桌面、活跃窗口或指定窗口 |

请求：

```json
{
  "op": "desktop.capture.screenshot",
  "id": "screenshot-id",
  "ts": 1781240000000,
  "payload": {
    "target": "active",
    "windowId": "window:123:0",
    "format": "jpeg",
    "quality": 80,
    "maxWidth": 1280
  }
}
```

| 请求字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `target` | string | `active` | `desktop`、`active` 或 `window`。 |
| `windowId` | string | - | `target: "window"` 时指定窗口。 |
| `format` | string | `jpeg` | 截图格式提示。 |
| `quality` | number | `80` | JPEG 压缩质量，建议 1-100。 |
| `maxWidth` | number | `1280` | 最大宽度，桌面端会等比缩放。 |

响应：

```json
{
  "op": "desktop.capture.screenshot",
  "id": "screenshot-id",
  "ts": 1781240000100,
  "payload": {
    "image": "data:image/jpeg;base64,/9j/4AAQ...",
    "width": 1280,
    "height": 720,
    "window": {
      "id": "window:123:0",
      "title": "main.py - Visual Studio Code",
      "processName": "Code",
      "app": {
        "displayName": "VS Code",
        "canonicalKey": "vscode",
        "confidence": "high",
        "isSystem": false
      }
    }
  }
}
```

| 响应字段 | 类型 | 说明 |
| --- | --- | --- |
| `image` | string | 截图数据。小图可为 data URL；大图可由桌面端先上传资源后返回资源 URL。 |
| `width` / `height` | number | 实际返回图片尺寸。 |
| `window` | object | 截图来源窗口摘要。 |
| `window.app` | object | 截图来源窗口的归一化应用身份；字段同 `desktop.window.list`。 |

## `desktop.tool.call`

`desktop.tool.call` 是通用桌面工具调用通道。桌面端在 `sys.handshake.payload.tools` 中声明可用工具，适配器可以按声明调用。

请求：

```json
{
  "op": "desktop.tool.call",
  "id": "tool-call-id",
  "ts": 1781240000000,
  "payload": {
    "tool": "capture_screenshot",
    "args": {
      "target": "active",
      "quality": 80
    }
  }
}
```

响应：

```json
{
  "op": "desktop.tool.call",
  "id": "tool-call-id",
  "ts": 1781240000100,
  "payload": {
    "tool": "capture_screenshot",
    "result": {
      "image": "data:image/jpeg;base64,...",
      "width": 1280,
      "height": 720
    }
  }
}
```

失败响应可以在 payload 内带 `error`：

```json
{
  "op": "desktop.tool.call",
  "id": "tool-call-id",
  "ts": 1781240000100,
  "payload": {
    "tool": "capture_screenshot",
    "error": "permission denied"
  }
}
```
