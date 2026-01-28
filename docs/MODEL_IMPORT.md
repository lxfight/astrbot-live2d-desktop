# Live2D Model Import

This repository does NOT ship any Live2D model assets (e.g. `*.moc3`, textures, motions) due to Live2D licensing terms.
You must only use models that you have the rights to use and distribute.

## Supported Format

- Live2D Cubism 4 (`*.model3.json` + `*.moc3`)

## Quick Start (Default Model for Local Dev)

```powershell
cd astrbot-live2d-desktop
pwsh -File .\\scripts\\fetch-default-model.ps1
```

This downloads an official sample model into `public/models/default/`.
The folder is ignored by git; do not commit the downloaded files.

## Provide Cubism Core Runtime (Required)

`pixi-live2d-display` requires `live2dcubismcore.min.js`.

Due to licensing terms, you must obtain it from Live2D's official "Cubism SDK for Web" and place it here:

`astrbot-live2d-desktop/public/lib/live2dcubismcore.min.js`

## Importing Your Own Model

### Option A: Import via the App UI (Electron)

1. Open Settings -> Model Management.
2. Click "Import model" and select a model folder that contains `*.model3.json`.

Notes:
- In development, imported models are copied into `public/models/<your-model>/`.
- In production builds, imported models may be copied into `dist/models/<your-model>/`.
- Both locations should be treated as local runtime data; do not commit them to git.

### Option B: Manually Add in Development

1. Copy your model folder into `public/models/<id>/` and make sure `model3.json` exists.
2. Add an entry into `public/models/manifest.json`:

```json
{
  "id": "my-model",
  "name": "My Model",
  "path": "models/my-model/model3.json"
}
```

## Troubleshooting

- Model does not render:
  - Confirm `public/lib/live2dcubismcore.min.js` exists.
  - Confirm the `path` points to a valid `*.model3.json`.
  - Open DevTools and check the Network tab for 404s.

