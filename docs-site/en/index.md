---
layout: home

hero:
  name: AstrBot Live2D Desktop
  text: Desktop client and bridge protocol docs
  tagline: A practical reference for running Live2D models with AstrBot, model aliases, media resources, and the L2D bridge protocol.
  actions:
    - theme: brand
      text: Get Started
      link: /en/guide/getting-started
    - theme: alt
      text: Protocol Reference
      link: /en/protocol/overview

features:
  - title: Desktop Client
    details: Electron + Vue client for model rendering, bubbles, media playback, screenshots, recording, and desktop-aware behavior.
  - title: AstrBot Adapter
    details: WebSocket bridge that turns AstrBot message chains and planner output into perform.show sequences.
  - title: Alias Protocol
    details: v2 state.model reports readable motion and expression names so LLM planners can trigger model-specific behavior safely.
---

## Current Release

| Component | Version | Notes |
| --- | --- | --- |
| Desktop | 1.5.0 | Adds v2 alias model payloads and model alias editing. |
| Bridge protocol | 1.0.0 + v2 alias extension | v1 packets remain compatible; v2 enriches `state.model` and `perform.show`. |
| AstrBot adapter | master after `9689fd3` | Required for full v2 alias payload support. |

## Documentation Map

- [Getting Started](./guide/getting-started.md): install, connect, import a model, and verify the bridge.
- [Usage Tutorial](./guide/usage.md): daily desktop use, recording, history, data maintenance, and FAQ.
- [Adapter Deployment](./adapter/deployment.md): AstrBot plugin installation, cloud deployment, security baseline, and common commands.
- [Cubism Runtime](./guide/cubism-runtime.md): official SDK integration, model discovery, profile metadata, and expression capability boundaries.
- [Architecture](./guide/architecture.md): how the desktop app, adapter, AstrBot, and model runtime cooperate.
- [Protocol Overview](./protocol/overview.md): packet layers and compatibility rules.
- [Connection](./protocol/connection.md): WebSocket, token, handshake response, heartbeat, and resource config.
- [Input Events](./protocol/input-events.md): message chains, touches, shortcuts, and desktop notifications.
- [State Model v2](./protocol/state-model-v2.md): model alias payload sent by the desktop client.
- [Perform Show](./protocol/perform-show.md): text, media, motion, expression, and alias execution.
- [Resources](./protocol/resources.md): `url` / `rid` / `inline` references and resource upload flow.
- [Desktop RPC](./protocol/desktop-rpc.md): window list, active window, screenshots, and tool calls.
- [Model Aliases](./model-config/overview.md): how to configure motion and expression names.
- [Platform Support](./release/platform-support.md): Windows, macOS, Linux X11/Wayland capability matrix.
