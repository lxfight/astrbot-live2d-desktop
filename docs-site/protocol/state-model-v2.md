# State Model v2

`state.model` tells the adapter what the current desktop model can do.

## Payload

```json
{
  "version": "2.0",
  "modelName": "Haru",
  "motions": [
    {
      "id": "TapBody_00",
      "name": "触摸身体1",
      "category": "action",
      "duration": 2400
    }
  ],
  "expressions": [
    {
      "id": "Smile",
      "name": "微笑"
    }
  ],
  "capabilities": {
    "idleMode": "noise+motion",
    "llmControlled": true
  }
}
```

## Fields

| Field | Meaning |
| --- | --- |
| `version` | `2.0` for alias model payloads. |
| `modelName` | Display name of the loaded model. |
| `motions[].id` | Stable desktop motion ID, usually `{group}_{index}`. |
| `motions[].name` | Human-readable alias sent back through `perform.show`. |
| `motions[].category` | `idle` for idle loops, `action` for normal actions. |
| `motions[].duration` | Estimated duration in milliseconds. |
| `expressions[].id` | Runtime expression ID. |
| `expressions[].name` | Human-readable expression alias. |

## Adapter Behavior

The adapter should:

- Store the original payload.
- Use `motions[].name` and `expressions[].name` for planner prompts.
- Prefer `perform.show` alias elements when talking to v2-capable desktop clients.
- Keep v1 `motionGroups` and `expressions: string[]` compatibility for older clients.
