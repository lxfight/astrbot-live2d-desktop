# Perform Show

`perform.show` asks the desktop client to display a sequence.

```json
{
  "op": "perform.show",
  "payload": {
    "interrupt": true,
    "sequence": [
      { "type": "text", "content": "你好！", "position": "center" },
      { "type": "motion", "name": "开心动作" },
      { "type": "expression", "name": "微笑", "holdMs": 1800, "resetPolicy": "previous" }
    ]
  }
}
```

## Element Types

| Type | Important Fields |
| --- | --- |
| `text` | `content`, `position` |
| `tts` / `audio` | `text`, `url`, `rid`, `inline`, `volume` |
| `image` / `video` | `url`, `rid`, `inline`, `autoplay` |
| `motion` | v2 `name`, or v1 `group` + `index` |
| `expression` | v2 `name`, v1 `id`, `combo`, `semantic`, `holdMs`, `resetPolicy` |
| `wait` / `delay` | `duration` |

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
