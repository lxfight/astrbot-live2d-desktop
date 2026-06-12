---
layout: home

hero:
  name: AstrBot Live2D Desktop
  text: Desktop client and bridge protocol docs
  tagline: A practical reference for running Live2D models with AstrBot, model aliases, media resources, and the L2D bridge protocol.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: Protocol v2
      link: /protocol/state-model-v2

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
- [Architecture](./guide/architecture.md): how the desktop app, adapter, AstrBot, and model runtime cooperate.
- [Protocol Overview](./protocol/overview.md): packet layers and compatibility rules.
- [State Model v2](./protocol/state-model-v2.md): model alias payload sent by the desktop client.
- [Perform Show](./protocol/perform-show.md): text, media, motion, expression, and alias execution.
- [Model Aliases](./model-config/overview.md): how to configure motion and expression names.
