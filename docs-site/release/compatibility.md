# Release Compatibility

## Version Matrix

| Desktop | Adapter | Status |
| --- | --- | --- |
| 1.5.0 | `9689fd3` or newer | Recommended for v2 alias payloads. |
| 1.5.0 | older adapter | Basic v1 behavior may work, alias planner behavior may be incomplete. |
| 1.4.x | current adapter | v1 protocol path remains compatible. |

## Release Checklist

Before publishing a desktop release:

1. Run `pnpm test`.
2. Run `pnpm run typecheck`.
3. Run `pnpm run docs:build`.
4. Confirm GitHub `Cross-Platform Smoke` is green on `master`.
5. Bump `package.json` to a new version.
6. Push a matching `vX.Y.Z` tag.

The build workflow validates that the pushed tag matches `package.json`.
