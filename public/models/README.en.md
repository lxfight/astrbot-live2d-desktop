# Live2D Model Directory

Place Live2D model files in this directory.

## Supported Formats

- Cubism 3.0+ (.moc3 / .model3.json)
- Cubism 4.0+ (.moc3 / .model3.json)

## Directory Structure Example

```
models/
├── hiyori/
│   ├── hiyori.model3.json
│   ├── hiyori.moc3
│   ├── textures/
│   ├── motions/
│   └── expressions/
└── shizuku/
    ├── shizuku.model3.json
    └── ...
```

## Loading Models

From the main window:

```typescript
live2dCanvasRef.value?.loadModel('/models/hiyori/hiyori.model3.json')
```

## Sample Model Downloads

- [Live2D Sample Models](https://github.com/guansss/pixi-live2d-display/tree/master/test/assets)
- [Live2D Official Samples](https://www.live2d.com/en/download/sample-data/)
