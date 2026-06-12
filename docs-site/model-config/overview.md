# Model Alias Configuration

Model aliases translate model-specific files into names that are useful to users and LLM planners.

## Motion Aliases

Each motion alias contains:

| Field | Meaning |
| --- | --- |
| `id` | Stable motion ID such as `TapBody_00`. |
| `name` | Alias used by `perform.show` v2. |
| `category` | `idle` or `action`. |
| `duration` | Estimated duration in milliseconds. |
| `enabled` | Whether the alias is exposed to the adapter. |

## Expression Aliases

Each expression alias contains:

| Field | Meaning |
| --- | --- |
| `id` | Runtime expression ID. |
| `name` | Alias used by `perform.show` v2. |
| `thumbnail` | Optional captured thumbnail. |
| `enabled` | Whether the alias is exposed to the adapter. |

## Recommended Workflow

1. Load a model.
2. Open the model settings page.
3. Auto-generate aliases from the scanned catalog.
4. Preview motions and expressions.
5. Rename aliases into stable, readable labels.
6. Save the model config.
7. Reconnect or reload the model so the adapter receives the new `state.model`.
