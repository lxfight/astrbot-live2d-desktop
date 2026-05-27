# AstrBot Live2D Desktop

[![QQ Group](https://img.shields.io/badge/QQ_Group-1101928371-blue?style=flat-square&logo=tencent-qq)](https://qm.qq.com/q/ZaEiwF7vuG)

Group access code: `F7vuG`

An Electron + Vue 3 Live2D desktop client.
Connects to AstrBot in real time, enabling models to display text, motions, expressions, voice, and multimedia content.

> This project was originally created to demonstrate the **completeness and compatibility of the AstrBot plugin ecosystem**, connecting to the desktop application through an adapter plugin. It also illustrates that **AstrBot's capabilities go far beyond existing default platforms** and can extend into many more scenarios. In terms of intelligence, **this project does not include any Agent functionality** — all input, output, interaction, and decision logic is defined and driven by the AstrBot side. The desktop client focuses solely on Live2D model rendering and presentation. The project may still have shortcomings, and **community PRs are very welcome** to help improve it together.

> Before use, install the AstrBot adapter plugin:
> [astrbot_plugin_live2d_adapter](https://github.com/lxfight/astrbot_plugin_live2d_adapter)

## Quick Links

- Detailed usage tutorial: [`docs/USAGE_TUTORIAL.en.md`](./docs/USAGE_TUTORIAL.en.md)
- Platform support matrix: [`docs/PLATFORM_SUPPORT.en.md`](./docs/PLATFORM_SUPPORT.en.md)
- Cubism integration guide: [`docs/CUBISM_RUNTIME.en.md`](./docs/CUBISM_RUNTIME.en.md)
- Protocol documentation: `AstrBot/data/plugins/astrbot-live2d-adapter/docs/API.md`
- Adapter deployment tutorial: `AstrBot/data/plugins/astrbot-live2d-adapter/docs/TUTORIAL.zh-CN.md`

## Features

- Live2D model rendering — Cubism 3/4 `.model3.json` models only
- Cubism 2 `.model.json` models are not supported
- Real-time interaction with AstrBot via WebSocket with low-latency message and performance push
- Text / image / voice input, automatically triggering performance sequence playback
- Message history, performance records, and statistical analysis
- Audio recording pipeline and global keyboard shortcuts
- Tray, always-on-top, mouse passthrough, and other desktop assistant capabilities

## Model Compatibility Boundaries

- The desktop client only accepts `.model3.json` as the model entry file; detecting `.model.json` will cause an immediate import rejection.
- "Cubism 3/4 support" means support for the `.model3.json` resource organization common in the Cubism 3/4 era, and does not imply Cubism 2 compatibility.
- Model motions and expressions are discovered in the following adaptive order:
  1. Standard `FileReferences` declarations inside `.model3.json`
  2. `.vtube.json` companion declarations in the model directory
  3. Recursive directory scan fallback for `.motion3.json` / `.exp3.json`
- If the model directory contains `astrbot.live2d.profile.json`, the application will attempt to load it automatically, supplementing the expression catalog with aliases, semantic tags, and semantic presets. If the file is missing, unreadable, or invalid, this additional semantic information is simply not applied.
- Directory scan fallback is a compatibility supplement and not equivalent to official standard declarations. When duplicate candidates are encountered, built-in rules determine precedence, and compatibility warnings may be produced.

## Expression Capability Boundaries

- `exp3`: The current expression catalog and combination capabilities are based on `.exp3.json` parsing results. Only successfully parsed expressions with valid parameters enter `combo` / `semantic` parameterized capability construction. If parsing fails or has no valid parameters, expressions may still be available as single-expression fallback if the native expression loaded successfully.
- `combo`: Supports combining multiple expressions in a single request with weighted blending. Stability depends on whether expression parameters conflict.
- `semantic`: Supports selecting expressions by semantic tags, but this is not arbitrary natural language understanding.
  - Only discovered expressions that have been successfully parsed with parameters participate in tag classification and semantic routing.
  - Expressions discovered only via directory scan do not automatically receive inferred semantic tags; explicit `tags` or `semanticPresets` must be configured in `astrbot.live2d.profile.json`.
- For more complete loading rules and limitations, see [`docs/CUBISM_RUNTIME.en.md`](./docs/CUBISM_RUNTIME.en.md).

## Quick Start

### 1) Download

Download the appropriate package from the [Releases](https://github.com/lxfight/astrbot-live2d-desktop/releases) page:

- Windows: `astrbot-live2d-desktop-v<version>-win-<arch>.exe` (installer) or `astrbot-live2d-desktop-v<version>-portable-<arch>.exe` (portable)
- macOS: `astrbot-live2d-desktop-v<version>-mac-<arch>.dmg`
- Linux: `astrbot-live2d-desktop-v<version>-linux-<arch>.AppImage`

> On first launch, the app will prompt you to download the Live2D Cubism Core runtime file (~200 KB). Click confirm to download automatically.

### 2) Prepare the Server

Install and enable `astrbot-live2d-adapter` in AstrBot, and ensure the server is running.

### 3) Configure Connection

In the desktop client "Settings → Connection", fill in:

1. Server address (e.g. `ws://127.0.0.1:9090/astrbot/live2d`)
2. Auth token (required, must match the adapter's `auth_token`)
3. Click connect

> The auth token is saved to the main process user config (encrypted when available) and does not need to be re-entered on restart.

### 4) Import a Model

On first launch, import a Live2D model directory containing `.model3.json` to begin chatting and interacting.

It is recommended to place the following companion files in the same model directory — the application will automatically include them in the discovery process and add them to the compatibility manifest when parseable:

- `.model3.json`: Standard model entry
- `.vtube.json`: Optional companion declaration
- `astrbot.live2d.profile.json`: Optional expression aliases / tags / semantic presets
- `.motion3.json` / `.exp3.json`: Discoverable via standard declarations, companion, or directory scan

## Development Guide

### Requirements

- Node.js >= 18
- pnpm

### Install Dependencies

```bash
pnpm install
```

The install phase automatically:

- Downloads the official Cubism Core to `public/lib/`
- Pulls a fixed version of the framework from the official repository
- Generates `.generated/cubism-framework/`
- Applies local project patches

### Common Commands

```bash
# Development
pnpm run dev

# Rebuild Electron native dependencies (better-sqlite3 / active-win etc.)
pnpm run rebuild

# Build (SDK not included — users download on first launch)
pnpm run build
pnpm run build:win
pnpm run build:mac
pnpm run build:linux
pnpm run build:dir

# Type check
pnpm run typecheck
```

### Build Artifact Naming

- Installer: `astrbot-live2d-desktop-v<version>-<os>-<arch>.<ext>`
- Windows portable: `astrbot-live2d-desktop-v<version>-portable-<arch>.exe`

> Note: Build artifacts do not include the Live2D Cubism SDK. The app prompts users to download it on first launch.

> Note: The repository does not directly include official framework source code in `src/`. See `docs/CUBISM_RUNTIME.en.md` for current integration details.

### Native Dependency Build Instructions (Windows)

If `better-sqlite3` rebuild fails, install **Visual Studio 2022 Build Tools** (select `Desktop development with C++`), then run:

```bash
pnpm run rebuild
```

## Security Recommendations

- Connection tokens must be enabled; do not use weak passwords
- When deploying on cloud servers, restrict the port source IP
- Prefer LAN or WSS connections to avoid cleartext transmission over the public internet
- Voice wake-on-voice is planned to be reintroduced in a future version; the current version does not provide this capability

## Data Storage

- SQLite: message history, performance records, statistics
- UserConfig (Electron Store, supports token encryption): connection configuration
- LocalStorage: UI preferences, theme state, model position, and other non-sensitive data
- Filesystem: imported models and cached resources

Common directories:

- Windows: `%APPDATA%/astrbot-live2d-desktop/`
- macOS: `~/Library/Application Support/astrbot-live2d-desktop/`
- Linux: `~/.config/astrbot-live2d-desktop/`

## Known Limitations

- Cubism 2 `.model.json` models are not supported
- `.vtube.json` is used only as a companion supplement and does not represent full compatibility with all VTube Studio configuration semantics
- `semantic` expression selection depends on the discovered expression catalog and profile annotations; not all third-party models are guaranteed to receive ideal semantic mappings
- Some newer moc3 versions may be incompatible depending on the Cubism Core version
- Transparent window and GPU driver combinations may have compatibility differences in certain environments

## Copyright Notice

This project does not include the Live2D Cubism SDK. On first launch, the app prompts users to download it from the official Live2D website. Use of the Live2D Cubism SDK is subject to the [Live2D Proprietary Software License Agreement](https://www.live2d.com/eula/live2d-proprietary-software-license-agreement_en.html).

## Related Projects

- [AstrBot](https://github.com/Soulter/AstrBot)
- [astrbot_plugin_live2d_adapter](https://github.com/lxfight/astrbot_plugin_live2d_adapter)
- [Live2D Cubism SDK](https://www.live2d.com/download/cubism-sdk/)

## License

MIT
