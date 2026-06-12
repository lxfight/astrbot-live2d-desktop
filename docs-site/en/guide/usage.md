# Usage Tutorial

This document is intended for desktop users and covers the complete workflow from connection to daily use.

## 1. Prerequisites

Please confirm:

- The `astrbot_plugin_live2d_adapter` adapter is installed and enabled in AstrBot.
- You have the authentication key (`auth_token`) used by the adapter.
- The desktop client and AstrBot server are network-reachable, either locally, on a LAN, or over the public internet.

If the adapter has no manually configured `auth_token`, one is generated automatically and saved to:

```text
AstrBot/data/plugin_data/astrbot-live2d-adapter/live2d_auth_token.txt
```

## 2. First Connection

1. Launch the desktop client, open Settings from the tray or main UI, and select Connection.
2. Fill in the server address:
   - Local: `ws://127.0.0.1:9090/astrbot/live2d`
   - Remote server: `ws://<server_ip>:9090/astrbot/live2d`
3. Fill in the auth token. It must exactly match the adapter-side `auth_token`.
4. Click Save and Connect.

Once connected, the token is saved locally and does not need to be re-entered on the next launch.

## 3. Importing Models

1. Click Import Model in the main window.
2. Select a directory containing `.model3.json`.
3. Wait for loading to complete.

After a successful import, the model and its position are remembered automatically.

### Supported Model Entry

- Only Cubism 3/4 `.model3.json` files are supported as model entries.
- Cubism 2 `.model.json` is not supported. If the directory contains only `.model.json`, the import fails immediately.
- If multiple `.model3.json` files exist in the same directory, the application selects a preferred entry using built-in heuristics. For complex directories, keep a single unambiguous main entry file.

### Motion and Expression Discovery

The desktop client discovers model motions and expressions in this order:

1. Standard `FileReferences` declarations in `.model3.json`.
2. `.vtube.json` companion declarations in the model directory.
3. Recursive directory-scan fallback for `.motion3.json` and `.exp3.json`.

This means:

- Standard declarations have the highest priority.
- `.vtube.json` is only a supplementary source, not a complete VTube Studio configuration compatibility layer.
- Directory scanning is a compatibility fallback. Files discovered by scanning do not necessarily carry the same semantics as standard declarations.

### `astrbot.live2d.profile.json`

If `astrbot.live2d.profile.json` exists in the model directory, the desktop client attempts to load it automatically.

It does not replace `.model3.json`; it supplements discovered expressions with metadata:

- `aliases`: expression catalog aliases.
- `tags`: semantic tags.
- `semanticPresets`: mappings from semantic presets to expression IDs.

If this file is missing, unreadable, or invalid, the model still loads. The extra semantic information is simply not applied.

## 4. Daily Use

### Text Chat

- Right-click the model to open the radial menu, then click Chat.
- Type and send a message. Server replies can be shown as bubbles, motions, expressions, voice, or multimedia.

### Expression Capability Boundaries

- `exp3`: The current expression catalog and combination capabilities are based on `.exp3.json` parsing results. Only successfully parsed expressions with valid parameters enter `combo` / `semantic` capability construction.
- `combo`: Multiple expressions can be combined in a single request with weighted blending. If multiple expressions hit conflicting parameter groups, the runtime converges the final result according to conflict rules.
- `semantic`: Expressions can be selected by tags such as `happy`, `sad`, `angry`, `thinking`, `neutral`, and `speaking`. Results depend on model filenames, parameter names, and tag configuration in `astrbot.live2d.profile.json`.

Expressions discovered only via directory scanning do not automatically receive full semantic tags. For stable semantic expression behavior, configure `tags` or `semanticPresets` in `astrbot.live2d.profile.json`.

### Voice Recording

- Press and hold the microphone button in the input area to start recording; release to send automatically.
- You can also configure a global recording shortcut in settings.

### Voice Wake

Voice wake is not available in the current version. It will be reintroduced later once the solution is stable.

### History and Statistics

- Open Settings -> History. Messages lets you browse and search local chat; Statistics shows message trends, content distribution, and active hours.
- Some older builds also expose history from the model context menu. Prefer the current settings sidebar.

### Data and Configuration Maintenance

- Settings -> Advanced -> Data management shows local database, embedded media, model library, and log usage. It also provides cache cleanup, log export, config import/export, and Live2D Core download.
- Press `Ctrl/Cmd+K` inside settings to jump to any settings page quickly.

## 5. FAQ

### Authentication Failed or Cannot Connect

- Verify that the desktop token exactly matches the adapter `auth_token`.
- Verify that the address includes the correct path: `/astrbot/live2d`.
- Verify that the server port is open, especially cloud security groups and host firewalls.

### Connection Drops Shortly After Connecting

- The most common causes are token mismatch or server-side policy rejection.
- Run `/live2d status` and `/live2d config` on the AstrBot side first.

### Cannot Send Images or Voice

- By default, the resource API shares the same host and port as the WebSocket. First check whether server port `9090` is reachable.
- If you manually configured advanced resource settings or a legacy dual-port mode, check the corresponding resource address, port, and token.

### Model Imported Successfully but Motions or Expressions Are Incomplete

- Check whether `.model3.json` correctly declares `Motions` and `Expressions`.
- If relying on a `.vtube.json` companion, confirm that referenced file paths exist.
- If relying on directory-scan fallback, confirm that `.motion3.json` / `.exp3.json` files are under the model directory.
- If semantic expressions are not as expected, check whether `astrbot.live2d.profile.json` configures `tags` or `semanticPresets` for the relevant expressions.

## 6. Recommended Reading

- [Adapter Deployment](../adapter/deployment.md)
- [Protocol Overview](../protocol/overview.md)
- [Perform Show](../protocol/perform-show.md)
- [Cubism Runtime](./cubism-runtime.md)
