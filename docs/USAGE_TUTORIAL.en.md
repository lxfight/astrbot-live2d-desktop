# AstrBot Live2D Desktop Usage Tutorial

This document is intended for desktop client users and covers the full workflow from connection to daily use.

## 1. Prerequisites

Please confirm:

- The `astrbot-live2d-adapter` adapter is installed and enabled in AstrBot.
- You have the authentication key (`auth_token`) used by the adapter.
- The desktop client and AstrBot server are network-reachable (local, LAN, or public internet).

> If the adapter has no manually configured `auth_token`, one is automatically generated and saved to:
> `AstrBot/data/plugin_data/astrbot-live2d-adapter/live2d_auth_token.txt`

## 2. First Connection (Required)

1. Launch the desktop client and open "Settings → Connection".
2. Fill in the server address, e.g.:
   - Local: `ws://127.0.0.1:9090/astrbot/live2d`
   - Remote server: `ws://<server_ip>:9090/astrbot/live2d`
3. Fill in the auth token (required, must match the adapter's `auth_token`).
4. Click "Connect".

Once connected, the token is saved locally and does not need to be re-entered on the next launch.

## 3. Importing Models

1. Click "Import Model" in the main window.
2. Select a directory containing `.model3.json`.
3. Wait for the loading to complete.

After a successful import, the model and its position are automatically remembered.

### 3.1 Currently Supported Model Entry

- Only Cubism 3/4 `.model3.json` is supported as the model entry.
- Cubism 2 `.model.json` is not supported. If the directory contains only `.model.json`, the import will fail immediately.
- If multiple `.model3.json` files exist in the same directory, the application selects a preferred entry using built-in heuristics, typically prioritizing the root directory and files whose names more closely match the directory name. For complex directories, it is recommended to keep only a single unambiguous entry file.

### 3.2 Motion and Expression Auto-Discovery

The desktop client does not rely solely on `.model3.json` as a single source. The current version integrates model motions and expressions in the following order:

1. Standard `FileReferences` declarations in `.model3.json`.
2. `.vtube.json` companion declaration in the model directory.
3. Recursive directory scan fallback for `.motion3.json` and `.exp3.json`.

This means:

- Standard declarations have the highest priority.
- `.vtube.json` is used only as a supplementary source and is not a full VTube Studio configuration compatibility layer.
- Directory scanning is only a compatibility fallback. Even if files are found via scanning, they do not carry semantics identical to standard declarations.

### 3.3 Purpose of `astrbot.live2d.profile.json`

If an `astrbot.live2d.profile.json` file exists in the model directory, the desktop client automatically attempts to load it.

Its role is not to replace `.model3.json`, but to supplement the already-discovered expressions with metadata:

- `aliases`: expression catalog aliases
- `tags`: semantic tags
- `semanticPresets`: mappings from semantic presets to expression IDs

If this file is missing, unreadable, or invalid, the model will still load successfully, but this additional semantic information will not be applied.

## 4. Daily Usage

### 4.1 Text Chat

- Right-click the model to open the radial menu and click "Chat".
- Type a message and send it; server replies are displayed as bubbles / motions / voice.

### 4.1.1 Expression Capability Boundaries

- `exp3`: The current expression catalog and combination capabilities are based on `.exp3.json` parsing results. Only successfully parsed expressions with valid parameters enter `combo` / `semantic` parameterized capability construction. If parsing fails or has no valid parameters, expressions may still be available as single-expression fallback if the native expression loaded successfully.
- `combo`: Supports combining multiple expressions in a single request with weighted blending. However, if multiple expressions hit conflicting parameter groups, the final result converges according to runtime conflict resolution — this is not unconditional full blending.
- `semantic`: Supports triggering expressions by tags such as `happy`, `sad`, `angry`, `thinking`, `neutral`, `speaking`, etc. Only discovered expressions that have been successfully parsed with parameters participate in semantic mapping. Results depend on model filenames, parameter names, and the tag configuration in `astrbot.live2d.profile.json`.
- Expressions discovered only via directory scan do not automatically receive full semantic tags. Typically, `tags` or `semanticPresets` must be explicitly configured in `astrbot.live2d.profile.json` for stable semantic expression capability.

### 4.2 Voice Recording

- Press and hold the microphone button in the input area to start recording; release to send automatically.
- You can also configure a global recording shortcut in settings.

### 4.3 Voice Wake (Planned)

- Voice wake is not yet available in the current version.
- It will be reintroduced in the next version once the solution is stabilized.

### 4.4 History & Statistics

- Right-click the model → "History" to view chat records, resource usage, and statistical charts.

## 5. FAQ

### 5.1 "Authentication Failed" or Cannot Connect

- Verify that the desktop client token exactly matches the adapter's `auth_token`.
- Verify that the address includes the correct path: `/astrbot/live2d`.
- Verify that the server port is open (cloud server scenarios).

### 5.2 Connection Drops Shortly After Connecting

- The most common cause is a token mismatch or a server-side policy rejection.
- Run `/live2d.status` and `/live2d.config` on the AstrBot side to check the status first.

### 5.3 Unable to Send Images / Voice

- By default, the resource interface shares the same server address and port as the WebSocket. First check whether server port `9090` is reachable.
- If you have manually used advanced resource settings or the legacy dual-port mode, check the corresponding resource address, port, and token.

### 5.4 Model Imported Successfully but Motions or Expressions Are Incomplete

- First check whether `.model3.json` correctly declares `Motions` and `Expressions`.
- If relying on a `.vtube.json` companion, confirm that the referenced file paths actually exist.
- If relying on directory scan fallback, confirm that `.motion3.json` / `.exp3.json` files are actually located in the model directory or its subdirectories.
- If semantic expressions are not as expected, first check whether `astrbot.live2d.profile.json` has configured `tags` or `semanticPresets` for the corresponding expressions.

## 6. Recommended Reading

- Adapter tutorial (includes cloud server firewall and security recommendations):
  `AstrBot/data/plugins/astrbot-live2d-adapter/docs/TUTORIAL.zh-CN.md`
- Bridge protocol documentation:
  `AstrBot/data/plugins/astrbot-live2d-adapter/docs/API.md`
