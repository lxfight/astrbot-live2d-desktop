# Perform Show

`perform.show` 用来请求桌面端执行一段展示序列。

| 项目 | 值 |
| --- | --- |
| 操作码 | `perform.show` |
| 方向 | 适配器 -> 桌面端 |
| 触发时机 | AstrBot 消息链转换完成、规划器生成后续表演、适配器主动提示 |
| 响应 | 通常无响应。需要停止当前表演时使用 `perform.interrupt`。 |

```json
{
  "op": "perform.show",
  "id": "perform-id",
  "ts": 1781240000000,
  "payload": {
    "interrupt": true,
    "interruptible": true,
    "sequence": [
      { "type": "text", "content": "你好！", "position": "center" },
      { "type": "motion", "name": "开心动作" },
      { "type": "expression", "name": "微笑", "holdMs": 1800, "resetPolicy": "previous" }
    ]
  }
}
```

## Payload 字段

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `interrupt` | boolean | 是 | 是否先中断当前表演。桌面端在 follow-up 场景可能保留当前气泡。 |
| `interruptible` | boolean | 否 | 当前序列是否允许后续表演中断。默认 `true`。 |
| `sequence` | PerformElement[] | 是 | 表演元素数组。`wait` / `delay` 会阻塞后续元素派发，其它类型进入各自队列。 |

## 元素类型

| 类型 | 用途 | 关键字段 |
| --- | --- | --- |
| `text` | 气泡文本 | `content`, `duration`, `position` |
| `tts` / `audio` | 音频播放 | `text`, `url`, `rid`, `inline`, `volume`, `speed` |
| `image` | 图片展示 | `url`, `rid`, `inline`, `duration`, `position` |
| `video` | 视频播放 | `url`, `rid`, `inline`, `duration`, `autoplay`, `loop` |
| `motion` | Live2D 动作 | v2 `name`，或 v1 `group` + `index` |
| `expression` | Live2D 表情 | v2 `name`、v1 `id`、`combo`、`semantic`、`holdMs`、`resetPolicy` |
| `wait` / `delay` | 等待 | `duration` |

## `text`

```json
{
  "type": "text",
  "content": "你好！",
  "duration": 3000,
  "position": "center"
}
```

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `content` | string | - | 气泡文本。为空时不会显示。 |
| `duration` | number | `3000` | 展示时长，单位毫秒。`0` 表示不等待持续时间。 |
| `position` | string | `center` | `top`、`center`、`bottom`。 |

## `tts` / `audio`

```json
{
  "type": "tts",
  "text": "你好！",
  "url": "https://example.com/audio.mp3",
  "rid": "resource-uuid",
  "inline": "data:audio/mp3;base64,...",
  "ttsMode": "remote",
  "volume": 1.0,
  "speed": 1.0
}
```

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `text` | string | - | TTS 对应文本，可用于记录或字幕。 |
| `url` | string | - | 音频 URL。 |
| `rid` | string | - | 资源 ID。桌面端会按握手配置解析资源 URL。 |
| `inline` | string | - | 内联 data URL 或 base64 数据。 |
| `ttsMode` | string | `remote` | 当前适配器主要使用远程音频。 |
| `volume` | number | `1.0` | 播放音量。 |
| `speed` | number | `1.0` | 语速提示，是否生效取决于音频来源。 |
| `duration` | number | - | 可选等待时间。设置后音频队列会额外等待该时长。 |

`url`、`rid`、`inline` 至少提供一个。

## `image`

```json
{
  "type": "image",
  "url": "https://example.com/image.png",
  "duration": 5000,
  "position": "center"
}
```

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `url` / `rid` / `inline` | string | - | 图片资源引用，至少提供一个。 |
| `duration` | number | `3000` | 展示时长，单位毫秒。 |
| `position` | string | `center` | 展示位置提示。 |

## `video`

```json
{
  "type": "video",
  "url": "https://example.com/video.mp4",
  "duration": 0,
  "position": "center",
  "autoplay": true,
  "loop": false
}
```

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `url` / `rid` / `inline` | string | - | 视频资源引用，至少提供一个。 |
| `duration` | number | - | 设置后视频队列等待该时长；未设置时按播放器事件结束。 |
| `position` | string | `center` | 展示位置提示。 |
| `autoplay` | boolean | `true` | 自动播放提示。 |
| `loop` | boolean | `false` | 循环播放提示。 |

## `motion`

### v2 别名写法

```json
{
  "type": "motion",
  "name": "开心动作",
  "priority": 2,
  "fadeIn": 300,
  "fadeOut": 300
}
```

### v1 运行时写法

```json
{
  "type": "motion",
  "group": "TapBody",
  "index": 0,
  "priority": 2,
  "loop": false,
  "fadeIn": 300,
  "fadeOut": 300,
  "motionType": "happy"
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `name` | string | v2 别名，必须来自最近一次 `state.model.motions[].name`。 |
| `group` | string | v1 动作组。 |
| `index` | number | v1 动作索引，默认 `0`。 |
| `priority` | number | 动作优先级，默认 `2`。 |
| `loop` | boolean | 是否循环。当前 v2 别名路径主要播放一次。 |
| `fadeIn` / `fadeOut` | number | 淡入淡出时间，单位毫秒。 |
| `motionType` | string | 语义提示，如 `happy`、`thinking`。是否消费取决于客户端实现。 |

::: warning
v2 `name` 未命中本地别名时，桌面端会忽略该动作并写入日志。适配器应只输出 `state.model` 中存在的动作别名。
:::

## `expression`

### v2 别名写法

```json
{
  "type": "expression",
  "name": "微笑",
  "fade": 300,
  "holdMs": 1800,
  "resetPolicy": "previous"
}
```

### v1 单表情写法

```json
{
  "type": "expression",
  "id": "Smile",
  "fade": 300,
  "holdMs": 1800,
  "resetPolicy": "previous"
}
```

### 组合表情

```json
{
  "type": "expression",
  "combo": [
    { "id": "Smile", "weight": 0.8 },
    { "id": "Blink", "weight": 0.2 }
  ],
  "holdMs": 1200,
  "resetPolicy": "previous"
}
```

### 语义表情

```json
{
  "type": "expression",
  "semantic": [
    { "tag": "thinking", "weight": 0.6 }
  ],
  "holdMs": 1200,
  "resetPolicy": "keep"
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `name` | string | v2 表情别名，来自 `state.model.expressions[].name`。 |
| `id` | string / number | v1 运行时表情 ID。 |
| `combo` | object[] | 表情组合数组。每项包含 `id`，可选 `weight`。 |
| `semantic` | object[] | 语义表情数组。每项包含 `tag`，可选 `weight`。 |
| `fade` | number | 切换淡入淡出时间，单位毫秒。 |
| `holdMs` | number | 保持时间，单位毫秒。 |
| `resetPolicy` | string | 结束后恢复策略。 |
| `motionType` | string | 语义提示。 |

### 表情约束

- `name`、`id`、`combo`、`semantic` 通常四选一。
- `combo` 只有在客户端声明 `capabilities.expressionCombo=true` 且条目 `supportsCombo=true` 时才应发送。
- `semantic` 只有在客户端声明 `capabilities.semanticExpression=true` 时才应发送。
- `weight` 建议范围为 `0.0` 到 `1.0`。
- `holdMs` 省略时由客户端决定保持策略。

## 打断规则

- `interrupt: true`：清除当前表演，除非桌面端将其视为 follow-up。
- `interrupt: false`：不清除当前气泡，追加或排队执行。
- `interruptible: true`：允许后续序列安全替换这段 follow-up。

## 表情重置

桌面端运行时目前支持这些常用重置策略：

- `previous`：回到之前的表情状态。
- `neutral`：淡出并回到中性状态。
- `keep`：保持当前表情。
- `fadeOut` / `default` / `hold`：v2 适配器路径会接受这些值，以兼容规划器 prompt。

::: tip
当前桌面端类型定义的核心策略是 `previous` / `neutral` / `keep`，运行时也兼容部分规划器历史写法。对新接入方，优先使用 `previous`、`neutral` 或 `keep`。
:::

## `wait` / `delay`

```json
{
  "type": "wait",
  "duration": 1000
}
```

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `duration` | number | `1000` | 等待时长，单位毫秒。 |

## `perform.interrupt`

`perform.interrupt` 用于请求桌面端中断当前可中断表演。

```json
{
  "op": "perform.interrupt",
  "id": "interrupt-id",
  "ts": 1781240000000
}
```
