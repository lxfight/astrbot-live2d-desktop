# Perform Show

`perform.show` asks the desktop client to display a performance sequence.

| Item | Value |
| --- | --- |
| Operation | `perform.show` |
| Direction | adapter -> desktop |
| Trigger | AstrBot message-chain conversion, planner follow-up output, or adapter-side prompts |
| Response | Usually none. Use `perform.interrupt` to stop the current performance. |

```json
{
  "op": "perform.show",
  "id": "perform-id",
  "ts": 1781240000000,
  "payload": {
    "interrupt": true,
    "interruptible": true,
    "sequence": [
      { "type": "text", "content": "Hello!", "position": "center" },
      { "type": "motion", "name": "Happy Motion" },
      { "type": "expression", "name": "Smile", "holdMs": 1800, "resetPolicy": "previous" }
    ]
  }
}
```

## Payload Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `interrupt` | boolean | yes | Whether to interrupt the current performance first. The desktop may preserve current bubbles in follow-up scenarios. |
| `interruptible` | boolean | no | Whether this sequence can be interrupted by a later performance. Default is `true`. |
| `sequence` | PerformElement[] | yes | Performance elements. `wait` / `delay` blocks later dispatch; other types enter their own queues. |

## Element Types

| Type | Purpose | Important fields |
| --- | --- | --- |
| `text` | Text bubble | `content`, `duration`, `position` |
| `tts` / `audio` | Audio playback | `text`, `url`, `rid`, `inline`, `volume`, `speed` |
| `image` | Image display | `url`, `rid`, `inline`, `duration`, `position` |
| `video` | Video playback | `url`, `rid`, `inline`, `duration`, `autoplay`, `loop` |
| `motion` | Live2D motion | v2 `name`, or v1 `group` + `index` |
| `expression` | Live2D expression | v2 `name`, v1 `id`, `combo`, `semantic`, `holdMs`, `resetPolicy` |
| `wait` / `delay` | Wait | `duration` |

## `text`

```json
{
  "type": "text",
  "content": "Hello!",
  "duration": 3000,
  "position": "center"
}
```

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `content` | string | - | Bubble text. Empty content is ignored. |
| `duration` | number | `3000` | Display duration in milliseconds. `0` means do not wait for a duration. |
| `position` | string | `center` | `top`, `center`, or `bottom`. |

## `tts` / `audio`

```json
{
  "type": "tts",
  "text": "Hello!",
  "url": "https://example.com/audio.mp3",
  "rid": "resource-uuid",
  "inline": "data:audio/mp3;base64,...",
  "ttsMode": "remote",
  "volume": 1.0,
  "speed": 1.0
}
```

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `text` | string | - | Text associated with TTS, useful for records or subtitles. |
| `url` | string | - | Audio URL. |
| `rid` | string | - | Resource ID. The desktop resolves it through handshake resource config. |
| `inline` | string | - | Inline data URL or base64 data. |
| `ttsMode` | string | `remote` | The adapter mainly uses remote audio. |
| `volume` | number | `1.0` | Playback volume. |
| `speed` | number | `1.0` | Speech-rate hint; whether it applies depends on the audio source. |
| `duration` | number | - | Optional wait duration after playback dispatch. |

At least one of `url`, `rid`, or `inline` must be present.

## `image`

```json
{
  "type": "image",
  "url": "https://example.com/image.png",
  "duration": 5000,
  "position": "center"
}
```

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `url` / `rid` / `inline` | string | - | Image resource reference. At least one is required. |
| `duration` | number | `3000` | Display duration in milliseconds. |
| `position` | string | `center` | Display position hint. |

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

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `url` / `rid` / `inline` | string | - | Video resource reference. At least one is required. |
| `duration` | number | - | If set, the video queue waits for this duration; otherwise it follows player events. |
| `position` | string | `center` | Display position hint. |
| `autoplay` | boolean | `true` | Autoplay hint. |
| `loop` | boolean | `false` | Loop hint. |

## `motion`

### v2 Alias Form

```json
{
  "type": "motion",
  "name": "Happy Motion",
  "priority": 2,
  "fadeIn": 300,
  "fadeOut": 300
}
```

### v1 Runtime Form

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

| Field | Type | Description |
| --- | --- | --- |
| `name` | string | v2 alias. Must come from the latest `state.model.motions[].name`. |
| `group` | string | v1 motion group. |
| `index` | number | v1 motion index, default `0`. |
| `priority` | number | Motion priority, default `2`. |
| `loop` | boolean | Whether to loop. The v2 alias path mainly plays once. |
| `fadeIn` / `fadeOut` | number | Fade durations in milliseconds. |
| `motionType` | string | Semantic hint, such as `happy` or `thinking`. Whether it is consumed depends on the client. |

::: warning
If v2 `name` does not match a local alias, the desktop client ignores the motion and logs a warning. Adapters should only output aliases present in `state.model`.
:::

## `expression`

### v2 Alias Form

```json
{
  "type": "expression",
  "name": "Smile",
  "fade": 300,
  "holdMs": 1800,
  "resetPolicy": "previous"
}
```

### v1 Single Expression Form

```json
{
  "type": "expression",
  "id": "Smile",
  "fade": 300,
  "holdMs": 1800,
  "resetPolicy": "previous"
}
```

### Combo Expression

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

### Semantic Expression

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

| Field | Type | Description |
| --- | --- | --- |
| `name` | string | v2 expression alias from `state.model.expressions[].name`. |
| `id` | string / number | v1 runtime expression ID. |
| `combo` | object[] | Expression combo array. Each item has `id` and optional `weight`. |
| `semantic` | object[] | Semantic expression array. Each item has `tag` and optional `weight`. |
| `fade` | number | Fade duration in milliseconds. |
| `holdMs` | number | Hold duration in milliseconds. |
| `resetPolicy` | string | Recovery strategy after hold. |
| `motionType` | string | Semantic hint. |

### Expression Constraints

- `name`, `id`, `combo`, and `semantic` are usually mutually exclusive.
- Send `combo` only when `capabilities.expressionCombo=true` and every entry supports combo.
- Send `semantic` only when `capabilities.semanticExpression=true`.
- Recommended `weight` range is `0.0` to `1.0`.
- If `holdMs` is omitted, the client decides the hold strategy.

## Interrupt Rules

- `interrupt: true`: clear current performance unless the desktop treats it as a follow-up.
- `interrupt: false`: append or enqueue without clearing current bubbles.
- `interruptible: true`: allows a later sequence to replace this follow-up safely.

## Expression Reset

The desktop runtime currently supports practical reset policies including:

- `previous`: return to the previous expression state.
- `neutral`: fade back to neutral.
- `keep`: leave the expression applied.
- `fadeOut` / `default` / `hold`: accepted by the v2 adapter path for compatibility with planner prompts.

::: tip
The current desktop type definition centers on `previous` / `neutral` / `keep`, while the runtime also accepts some historical planner values. For new integrations, prefer `previous`, `neutral`, or `keep`.
:::

## `wait` / `delay`

```json
{
  "type": "wait",
  "duration": 1000
}
```

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `duration` | number | `1000` | Wait duration in milliseconds. |

## `perform.interrupt`

`perform.interrupt` asks the desktop client to interrupt the current interruptible performance.

```json
{
  "op": "perform.interrupt",
  "id": "interrupt-id",
  "ts": 1781240000000
}
```
