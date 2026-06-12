# Getting Started

## Install The Pieces

1. Install AstrBot and enable `astrbot_plugin_live2d_adapter`.
2. Launch AstrBot with the adapter enabled.
3. Open AstrBot Live2D Desktop.
4. In desktop settings, set the bridge URL to `ws://127.0.0.1:9090/astrbot/live2d`.
5. Use the same auth token on both sides.

## Import A Model

The desktop client supports Cubism 3/4 `.model3.json` entries. Import a model directory from the model library. After import, the client scans motions and expressions from:

1. `.model3.json` standard declarations.
2. `.vtube.json` companion declarations.
3. Directory scan fallback for `.motion3.json` and `.exp3.json`.

## Verify Connection

After connecting, the desktop client sends:

- `sys.handshake`
- `state.ready`
- `state.model`

For v1.5.0, `state.model` uses the v2 alias extension by default. The adapter stores the payload and uses it when converting AstrBot replies or planner follow-up sequences.

## Recommended Smoke Test

Send a normal AstrBot message and confirm:

- A text bubble appears.
- Audio/media elements play if present.
- The adapter log shows a `perform.show` sequence.
- The model info log includes v2 motions and expressions when aliases are available.
