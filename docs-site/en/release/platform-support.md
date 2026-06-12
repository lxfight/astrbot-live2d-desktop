# Platform Support Matrix

This page describes the current support status of `astrbot-live2d-desktop` across desktop platforms, helping with release decisions, troubleshooting, and user support.

## Overview

| Capability | Windows | macOS | Linux (X11) | Linux (Wayland) |
| --- | --- | --- | --- | --- |
| Application packages | Supported (NSIS / Portable) | Supported (DMG / ZIP) | Supported (AppImage / deb / rpm) | Supported (AppImage / deb / rpm) |
| Auto-update | Supported | Supported | Not supported | Not supported |
| Transparent overlay window | Supported | Supported | Depends on desktop environment / window manager | Depends on desktop environment / compositor |
| Always-on-top | Supported | Supported (`screen-saver` level) | Supported, varies by desktop environment | Supported, varies by compositor |
| Smart mouse passthrough | Supported | Supported | Not supported | Not supported |
| Full-screen app detection | Supported (`node-window-manager`) | Heuristic support (`active-win`) | Heuristic support (`active-win`) | Not supported |
| Live2D model rendering | Supported | Supported | Supported | Supported |
| Desktop screenshot tool | Supported | Supported | Supported | Supported |
| Global recording shortcuts | Supported | Supported | Supported | Supported |

## Platform Differences

### Windows

- Most complete experience.
- Transparent windows, always-on-top, smart passthrough, and full-screen app detection have the strongest implementation on Windows.
- Auto-update is supported for installer builds; portable builds do not support auto-update.
- `win32 arm64` currently disables native full-screen window detection to avoid unstable behavior.

### macOS

- Transparent windows, always-on-top, and shortcuts are available.
- Full-screen app detection uses `active-win` heuristic window-boundary checks, so stability is weaker than Windows.
- Auto-update is available.
- Always-on-top uses the `screen-saver` level to reduce the chance of being covered by other windows.

### Linux (X11)

- Core features are available: connection, model rendering, history, screenshots, recording shortcuts, and release packaging.
- Smart passthrough is unavailable because the platform cannot reliably forward mouse events.
- Full-screen app detection uses `active-win` heuristics. Accuracy depends on the desktop environment and window manager.
- Auto-update is unavailable. Users need to download new versions manually.

### Linux (Wayland)

- Core features are available: connection, model rendering, history, screenshots, recording shortcuts, and release packaging.
- Smart passthrough is unavailable because the platform cannot reliably forward mouse events.
- Automatic full-screen app detection is unavailable because the current implementation cannot reliably obtain active window bounds.
- Auto-update is unavailable. Users need to download new versions manually.
- This environment has the largest cross-platform experience gap. When users report anomalies, first confirm whether they are using a Wayland session.

## Runtime Notification Policy

Recommended proactive notifications:

- `Linux (Wayland)`: notify users that smart passthrough and full-screen app detection are unavailable.
- `Linux (X11)`: notify users that smart passthrough is unavailable and full-screen app detection is heuristic.
- `Windows arm64`: notify users that full-screen app detection is disabled, while other capabilities remain normal.

## Troubleshooting Recommendations

- If the model cannot automatically avoid full-screen windows, first verify the platform and session type.
- If users report click-through or window z-order issues, first distinguish between `Windows/macOS` and `Linux`.
- On Linux, validate under an X11 session first. On Wayland, expect partial capability degradation.
- If native modules fail after packaging, first check whether the target platform completed the matching Electron native dependency rebuild.
