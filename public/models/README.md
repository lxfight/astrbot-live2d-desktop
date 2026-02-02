# Live2D 模型目录

将 Live2D 模型文件放置在此目录下。

## 支持的格式

- Cubism 2.1 (.moc / .model.json)
- Cubism 3.0+ (.moc3 / .model3.json)
- Cubism 4.0+ (.moc3 / .model3.json)

## 目录结构示例

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

## 加载模型

在主窗口中调用：
```typescript
live2dCanvasRef.value?.loadModel('/models/hiyori/hiyori.model3.json')
```

## 示例模型下载

- [Live2D Sample Models](https://github.com/guansss/pixi-live2d-display/tree/master/test/assets)
- [Live2D Official Samples](https://www.live2d.com/en/download/sample-data/)
