# Cubism Runtime Guide

This document describes the **actual integration approach** for Live2D Cubism in the current repository, replacing the outdated migration draft.

## Current Baseline

- Rendering: **Official Cubism SDK for Web**
- Baseline version: `5-r.4`
- Core source: Runtime loads the official Core file via `cubism://core/live2dcubismcore.min.js`
- Framework source: A fixed version is pulled from the official repository during the install phase and generated into `.generated/cubism-framework/`

## Key Constraints

- **Official SDK source code does not enter the `src/` directory**
- `.generated/cubism-framework/` is a build-generated directory and is not committed to the repository
- `public/lib/live2dcubismcore.min.js` is the runtime Core file, not a framework copy from the source tree

## Runtime Flow

### Development / Install Phase

Running `pnpm install` performs the following actions:

1. Rebuild Electron native dependencies
2. Download the official Cubism Core to `public/lib/`
3. Pull the fixed version of `CubismWebFramework`
4. Generate the framework into `.generated/cubism-framework/`
5. Apply local patches to the framework

Related scripts:

- `scripts/cubism-config.js`
- `scripts/download-cubism-core.js`
- `scripts/download-framework.js`
- `scripts/apply-cubism-framework-patches.mjs`

### Application Runtime Phase

1. Electron registers the `cubism://` protocol
2. The renderer process preloads Core on demand via multi-entry pages (`main.html` etc.)
3. `src/utils/cubism/CubismModel.ts` uses the generated official framework via `@cubism-framework`
4. Model data is loaded in order: `.model3.json` → `.moc3` → expression → physics → pose → motion, with textures loaded separately after WebGL initialization

## Current Implementation Scope

The current branch covers:

- `.model3.json` model loading
- Motions / expressions / lip-sync
- Physics / pose / hit-test
- Drag, position save, and window passthrough coordination
- Electron import model resource validation

## Model Support Boundaries

- The desktop client currently only supports Cubism 3/4 `.model3.json` model entries.
- Cubism 2 `.model.json` is not supported and will be rejected at the import stage.
- "Cubism 3/4 support" refers to support for the `.model3.json` resource structure of that era and does not imply compatibility with the Cubism 2 legacy model chain.

## Motion and Expression Discovery Order

Model motions and expressions are not obtained solely from the `.model3.json` single path. The current implementation integrates declarations in the following order:

1. Standard declarations: reads `FileReferences.Expressions` and `FileReferences.Motions` from `.model3.json`.
2. Companion declarations: reads `.vtube.json` in the model directory.
3. Directory scan fallback: recursively scans the model directory for `.exp3.json` and `.motion3.json`.

Discovery results are aggregated into a compatibility manifest with recorded sources:

- `model3`: from `.model3.json` standard declarations
- `companion`: from `.vtube.json`
- `scan`: from directory scan fallback

When only standard declarations are present, the discovery mode is `standard`; when standard declarations are mixed with compatibility sources, it is `hybrid`; when primarily relying on companion or scanning, it is `compatibility`.

## Actual Scope of `.vtube.json` Companion

The current implementation treats `.vtube.json` only as a companion compatibility layer, not a full VTube Studio configuration interpreter.

Only the following content is consumed:

- `FileReferences.IdleAnimation`
- `FileReferences.IdleAnimationWhenTrackingLost`
- `Hotkeys` entries that can be mapped to `.exp3.json` or `.motion3.json`

This means:

- The companion can supplement idle animations, `IdleTrackingLost` motion groups, and some hotkey-mapped expressions/motions.
- The desktop client currently only discovers `IdleAnimationWhenTrackingLost` as an `IdleTrackingLost` motion group, and does not yet implement automatic switching on tracking-loss state.
- The companion cannot replace the `.model3.json` main manifest and does not guarantee full preservation of the original semantics from third-party tools.

## Actual Scope of Directory Scan Fallback

Directory scanning is a compatibility supplement, not a standard pipeline. The current implementation recursively scans the model directory and automatically collects:

- `.exp3.json` expression files
- `.motion3.json` motion files

Characteristics and limitations:

- Scanned expressions and motions are added to the compatibility manifest.
- Duplicate candidates may trigger selection logic, such as preferring shallower directories, specific directory structures, or filename matches.
- Discovery conflicts or missing declarations are recorded as warnings in the compatibility info.
- Scanned results are better suited as a "best-effort" fallback rather than a sole precise semantic source.

## Adaptive Loading of `astrbot.live2d.profile.json`

If `astrbot.live2d.profile.json` exists in the model directory, the runtime automatically attempts to load it. If the file is missing, unreadable, or invalid, this semantic enhancement layer is simply skipped.

It is not a model main configuration but an expression semantic enhancement layer, currently carrying only:

- `aliases`: supplements the expression catalog with resolvable aliases
- `tags`: explicitly assigns semantic tags to expression IDs
- `semanticPresets`: presets candidate expressions for semantic tags

Current behavior highlights:

- The profile participates in `expressionCatalog` and `semanticPresets` construction after expression files are loaded, and supplements aliases into runtime-resolvable expression entries.
- When the profile is present, the `expressionProfile` capability is marked as available.
- A missing profile does not block model loading — it only reduces semantic layer information.

## `exp3` / `combo` / `semantic` Capability Boundaries

### `exp3`

- The current expression catalog and parameterized capabilities are based on `.exp3.json` parsing results.
- Only successfully parsed expression files with valid parameters participate in `combo` / `semantic` parameterized capability construction.
- Files that fail parsing or have no valid parameters may still be available as single-expression fallback if the native expression loaded successfully.

### `combo`

- The runtime supports specifying multiple expressions in a single request with weighted blending.
- The combination capability is built on top of parsed `.exp3.json` parameter sets, not simple side-by-side file playback.
- If multiple expressions hit the same conflict group, the runtime performs conflict convergence; thus `combo` is "constrained multi-expression blending", not unrestricted mixing.

### `semantic`

- The runtime supports selecting expressions by semantic tags such as `happy`, `sad`, `angry`, `surprised`, `thinking`, `neutral`, `speaking`.
- Some of these tags come from explicit `tags` in `astrbot.live2d.profile.json`, and some are inferred from the IDs and parameter names of successfully parsed expressions.
- `semanticPresets` can explicitly specify which expression IDs a given tag should preferentially map to.

Important limitations:

- Expressions discovered only via directory scan do not automatically receive inferred semantic tags. Without explicit `tags` in the profile, such expressions typically do not enter stable `semantic` presets.
- Therefore, the most reliable way to make semantic expressions stable and controllable for third-party models is still to provide an `astrbot.live2d.profile.json`.

## Removed Content

The following legacy approaches are no longer part of the main runtime chain:

- `pixi-live2d-display`
- `pixi.js`
- `src/utils/Live2DModel.ts`
- Vendored framework copies in `src/framework/`

## Verification Commands

Before committing, at minimum the following should pass:

```bash
pnpm test
pnpm run typecheck
pnpm run build:prepare
```

## Related Files

- `package.json`
- `electron/utils/downloadCubismCore.ts`
- `electron/ipc/model.ts`
- `src/components/Live2D/Canvas.vue`
- `src/utils/cubism/CubismModel.ts`
- `tsconfig.json`
- `vite.config.ts`
