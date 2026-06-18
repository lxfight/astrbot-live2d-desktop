# Desktop RPC

Desktop RPC operations are requested by the adapter and executed by the desktop client. The desktop responds with the same `op` and the same `id`.

::: warning
Screenshots and window information may contain sensitive content. Adapters and upper-level plugins should use these capabilities only in user-authorized interaction flows.
:::

## `desktop.window.list`

| Item | Value |
| --- | --- |
| Direction | adapter -> desktop request, desktop -> adapter response |
| Purpose | List windows that can be captured |

Request:

```json
{
  "op": "desktop.window.list",
  "id": "window-list-id",
  "ts": 1781240000000
}
```

Response:

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

| Field | Type | Description |
| --- | --- | --- |
| `windows[].id` | string | Desktop window ID, usable as `desktop.capture.screenshot.windowId`. |
| `windows[].title` | string | Window title. |
| `windows[].processName` | string | Process name; may be empty on some platforms. |
| `windows[].app.displayName` | string | Normalized app display name. |
| `windows[].app.canonicalKey` | string | Stable app identity key; prefer this field for cross-platform app matching. |
| `windows[].app.confidence` | string | Recognition confidence: `high`, `medium`, or `low`. |
| `windows[].app.isSystem` | boolean | Whether the app is recognized as a system/shell app. |
| `windows[].isActive` | boolean | Whether this is the active window. |
| `windows[].bounds` | object | Window bounds; availability depends on platform. |

## `desktop.window.active`

| Item | Value |
| --- | --- |
| Direction | adapter -> desktop request, desktop -> adapter response |
| Purpose | Get the current active window |

Request:

```json
{
  "op": "desktop.window.active",
  "id": "active-window-id",
  "ts": 1781240000000
}
```

Response:

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

When no window is available, `payload.window` is `null`.

## `desktop.capture.screenshot`

| Item | Value |
| --- | --- |
| Direction | adapter -> desktop request, desktop -> adapter response |
| Purpose | Capture desktop, active window, or a specific window |

Request:

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

| Request Field | Type | Default | Description |
| --- | --- | --- | --- |
| `target` | string | `active` | `desktop`, `active`, or `window`. |
| `windowId` | string | - | Required when `target: "window"`. |
| `format` | string | `jpeg` | Screenshot format hint. |
| `quality` | number | `80` | JPEG quality, recommended 1-100. |
| `maxWidth` | number | `1280` | Maximum width; the desktop scales proportionally. |

Response:

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

| Response Field | Type | Description |
| --- | --- | --- |
| `image` | string | Screenshot data. Small screenshots may be data URLs; large screenshots may be uploaded first and returned as resource URLs. |
| `width` / `height` | number | Actual returned image size. |
| `window` | object | Source window summary. |
| `window.app` | object | Normalized app identity for the captured source window; fields match `desktop.window.list`. |

## `desktop.tool.call`

`desktop.tool.call` is the generic desktop tool channel. The desktop declares available tools in `sys.handshake.payload.tools`, and the adapter can call them by declaration.

Request:

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

Response:

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

Failures may use `error` inside the payload:

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
