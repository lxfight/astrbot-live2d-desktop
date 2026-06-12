# Protocol Overview

The bridge protocol is packet-based. Each packet has:

```json
{
  "op": "perform.show",
  "id": "uuid",
  "ts": 1781240000000,
  "payload": {}
}
```

## Layers

| Layer | Examples | Direction |
| --- | --- | --- |
| System | `sys.handshake`, `sys.ping` | both |
| Input | `input.message`, `input.touch` | desktop to adapter |
| Perform | `perform.show`, `perform.interrupt` | adapter to desktop |
| State | `state.ready`, `state.model` | desktop to adapter |
| Resource | `resource.prepare`, `resource.get` | both |
| Desktop tools | screenshots, active window, window list | adapter to desktop RPC |

## Compatibility

The v2 alias extension does not replace v1 packets. It adds richer `state.model` fields and lets `perform.show` use readable `name` values:

- v1 motion: `{ "type": "motion", "group": "TapBody", "index": 0 }`
- v2 motion: `{ "type": "motion", "name": "触摸身体1" }`
- v1 expression: `{ "type": "expression", "id": "Smile" }`
- v2 expression: `{ "type": "expression", "name": "微笑" }`
