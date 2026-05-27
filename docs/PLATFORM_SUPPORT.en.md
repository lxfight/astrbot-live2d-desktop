# Platform Support Matrix

This document describes the current support status of `astrbot-live2d-desktop` across different desktop platforms, helping you quickly assess capability boundaries when releasing, troubleshooting, and answering user questions.

## Overview

| Capability | Windows | macOS | Linux (X11) | Linux (Wayland) |
| --- | --- | --- | --- | --- |
| Application packages | Supported (NSIS / Portable) | Supported (DMG / ZIP) | Supported (AppImage / deb / rpm) | Supported (AppImage / deb / rpm) |
| Auto-update | Supported | Supported | Not supported | Not supported |
| Transparent overlay main window | Supported | Supported | Depends on DE / window manager | Depends on DE / compositor |
| Always-on-top | Supported | Supported (screen-saver level) | Supported (effect varies by DE) | Supported (effect varies by compositor) |
| Smart mouse passthrough | Supported | Supported | Not supported | Not supported |
| Full-screen app detection | Supported (native window manager) | Heuristic support (active-win) | Heuristic support (active-win) | Not supported |
| Live2D model rendering | Supported | Supported | Supported | Supported |
| Desktop screenshot tool | Supported | Supported | Supported | Supported |
| Global recording shortcuts | Supported | Supported | Supported | Supported |

## Platform Differences

### Windows

- Most complete experience.
- Transparent windows, always-on-top, smart passthrough, and full-screen app detection are all at their best implementation.
- Auto-update is supported for the installer version; portable version does not support auto-update.
- `win32 arm64` currently disables native full-screen window detection to avoid unstable behavior.

### macOS

- Transparent windows, always-on-top, and shortcuts are available.
- Full-screen app detection relies on heuristic window boundary judgment via `active-win`, with stability weaker than on Windows.
- Auto-update is available.
- Always-on-top uses the `screen-saver` level to minimize the chance of being covered by other windows.

### Linux (X11)

- Basic features are available: connection, model rendering, history, screenshots, recording shortcuts, and release packaging.
- Smart passthrough is unavailable (the current platform cannot reliably forward mouse events).
- Full-screen app detection uses `active-win` heuristics; accuracy depends on the desktop environment and window manager.
- Auto-update is unavailable; users need to manually download new versions.

### Linux (Wayland)

- Core features are available: connection, model rendering, history, screenshots, recording shortcuts, and release packaging.
- Smart passthrough is unavailable (the current platform cannot reliably forward mouse events).
- Automatic full-screen app detection is unavailable because the current implementation cannot reliably obtain active window bounds.
- Auto-update is unavailable; users need to manually download new versions.
- This is the runtime environment with the greatest cross-platform experience differences. When users report anomalies, first confirm whether it is a Wayland session.

## Runtime Notification Policy

It is recommended to proactively notify users in the following situations:

- `Linux (Wayland)`: Notify that "Smart passthrough" and "Full-screen app detection" are unavailable.
- `Linux (X11)`: Notify that "Smart passthrough" is unavailable and "Full-screen app detection" is a heuristic capability.
- `Windows arm64`: Notify that "Full-screen app detection" is disabled, but other capabilities are normal.

## Troubleshooting Recommendations

- When users report that the model cannot automatically avoid full-screen windows, first verify the platform and session type.
- When users report click-through or window z-order anomalies, first distinguish between `Windows/macOS` and `Linux`.
- On Linux, validate under an X11 session first; on Wayland, accept partial capability degradation.
- If native modules behave abnormally after packaging, first check whether the target platform has completed the corresponding Electron native dependency rebuild.
