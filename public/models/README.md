# public/models

This repository does NOT ship any Live2D model files (e.g. `*.moc3`, textures, motions) due to Live2D's licensing terms.

To get a local default model for development, run:

```powershell
cd astrbot-live2d-desktop
pwsh -File .\\scripts\\fetch-default-model.ps1
```

The script downloads the model from Live2D's official sample repository into:

`astrbot-live2d-desktop/public/models/default/`

Notes:
- `public/models/manifest.json` is tracked in git; model assets are ignored by `.gitignore`.
- For production builds, make sure your model assets are available at runtime (do not commit them back into this repo).

