# Live2D 模型导入指南

本指南将帮助你导入和使用自定义 Live2D 模型。

## 目录

- [支持的模型格式](#支持的模型格式)
- [模型文件结构](#模型文件结构)
- [导入方法](#导入方法)
- [常见问题](#常见问题)

---

## 支持的模型格式

本应用支持 **Live2D Cubism 4.0** 格式的模型（`.model3.json`）。

**不支持的格式：**
- Live2D Cubism 2.0/3.0 格式（`.model.json`, `.moc`）需要转换
- VRM 格式
- MMD 格式

**如何确认模型版本：**

查看模型定义文件扩展名：
- `model3.json` → Cubism 4.0 ✅
- `model.json` → Cubism 2.0/3.0 ❌

---

## 模型文件结构

一个完整的 Live2D 模型包含以下文件：

```
my-model/
├── model3.json          # 模型定义文件（必需）
├── *.moc3               # 模型数据文件（必需）
├── textures/            # 纹理图片目录（必需）
│   ├── texture_00.png
│   └── texture_01.png
├── motions/             # 动作文件目录（可选）
│   ├── idle_01.motion3.json
│   ├── tap_body.motion3.json
│   └── ...
├── expressions/         # 表情文件目录（可选）
│   ├── happy.exp3.json
│   ├── sad.exp3.json
│   └── ...
└── *.physics3.json      # 物理文件（可选）
```

### 必需文件

1. **model3.json** - 模型定义文件
   - 定义模型的基本信息
   - 引用其他资源文件的路径

2. **.moc3** - 模型数据文件
   - 包含模型的网格和变形数据
   - 二进制格式，无法直接编辑

3. **textures/** - 纹理图片目录
   - PNG 格式的纹理贴图
   - 通常有 1-4 张纹理

### 可选文件

1. **motions/** - 动作文件
   - `.motion3.json` 格式
   - 定义各种动作动画

2. **expressions/** - 表情文件
   - `.exp3.json` 格式
   - 定义面部表情

3. **.physics3.json** - 物理文件
   - 定义头发、衣服等的物理效果

---

## 导入方法

### 方法一：通过设置界面导入（推荐）

1. 启动应用
2. 右键点击托盘图标 → **设置**
3. 进入 **模型管理** 选项卡
4. 点击 **导入模型** 按钮
5. 选择模型文件夹
6. 应用会自动验证并导入模型

### 方法二：手动复制到模型目录

1. 找到应用的模型目录：
   - Windows: `%APPDATA%/astrbot-live2d-desktop/models/`
   - macOS: `~/Library/Application Support/astrbot-live2d-desktop/models/`
   - Linux: `~/.config/astrbot-live2d-desktop/models/`

2. 创建新的模型文件夹（使用唯一 ID）：
   ```bash
   cd models/
   mkdir my-model
   ```

3. 复制模型文件到该文件夹：
   ```
   models/
   └── my-model/
       ├── model3.json
       ├── Hiyori.moc3
       ├── textures/
       └── ...
   ```

4. 更新 `manifest.json`：
   ```json
   {
     "models": [
       {
         "id": "default",
         "name": "默认模型",
         "path": "/models/default/model3.json"
       },
       {
         "id": "my-model",
         "name": "我的模型",
         "path": "/models/my-model/model3.json",
         "thumbnail": "/models/my-model/thumbnail.png",
         "description": "自定义模型"
       }
     ]
   }
   ```

5. 重启应用

### 方法三：开发模式（仅用于测试）

在开发模式下，可以直接将模型放到 `public/models/` 目录：

```bash
cd public/models/
mkdir test-model
# 复制模型文件...
```

然后修改 `public/models/manifest.json` 添加模型信息。

---

## 模型配置

### model3.json 示例

```json
{
  "Version": 3,
  "FileReferences": {
    "Moc": "Hiyori.moc3",
    "Textures": [
      "textures/texture_00.png",
      "textures/texture_01.png"
    ],
    "Physics": "Hiyori.physics3.json",
    "Motions": {
      "Idle": [
        { "File": "motions/idle_01.motion3.json" }
      ],
      "TapBody": [
        { "File": "motions/tap_body.motion3.json" }
      ]
    },
    "Expressions": [
      { "Name": "happy", "File": "expressions/happy.exp3.json" },
      { "Name": "sad", "File": "expressions/sad.exp3.json" }
    ]
  },
  "Groups": [
    {
      "Target": "Parameter",
      "Name": "EyeBlink",
      "Ids": ["ParamEyeLOpen", "ParamEyeROpen"]
    }
  ],
  "HitAreas": [
    { "Name": "Head", "Id": "HitAreaHead" },
    { "Name": "Body", "Id": "HitAreaBody" }
  ]
}
```

### 重要字段说明

- **Version**: 必须为 `3`（Cubism 4.0）
- **FileReferences.Moc**: 指向 `.moc3` 文件
- **FileReferences.Textures**: 纹理文件列表
- **FileReferences.Motions**: 动作分组
- **FileReferences.Expressions**: 表情列表
- **HitAreas**: 点击区域定义

---

## 验证模型

### 使用应用内工具验证

应用会自动验证导入的模型：

- ✅ 检查 `model3.json` 格式
- ✅ 检查 `.moc3` 文件是否存在
- ✅ 检查纹理文件是否存在
- ✅ 检查文件路径是否正确

### 手动验证清单

1. **文件完整性**
   - [ ] `model3.json` 存在且格式正确
   - [ ] `.moc3` 文件存在
   - [ ] 所有纹理文件存在

2. **路径正确性**
   - [ ] `model3.json` 中的路径使用相对路径
   - [ ] 路径使用正斜杠 `/`（Windows 也用 `/`）
   - [ ] 文件名大小写匹配

3. **文件格式**
   - [ ] 纹理为 PNG 格式
   - [ ] JSON 文件格式正确（可用 JSON 验证器检查）

---

## 模型优化

### 减小文件大小

1. **压缩纹理**
   - 使用 PNG 优化工具（如 TinyPNG）
   - 分辨率建议：2048x2048 或更小

2. **简化动作**
   - 删除不必要的动作文件
   - 降低动作帧率（如 30fps → 24fps）

3. **减少表情**
   - 只保留常用表情

### 提升性能

1. **使用较低的纹理分辨率**
   - 桌宠应用通常不需要超高清纹理
   - 建议：1024x1024 或 2048x2048

2. **优化网格复杂度**
   - 在 Cubism Editor 中简化网格

3. **禁用不必要的物理效果**
   - 移除或简化 `.physics3.json`

---

## 常见问题

### Q: 模型不显示怎么办？

**可能原因：**

1. **模型格式不支持**
   - 确认是 Cubism 4.0 格式（`model3.json`）
   - Cubism 2.0/3.0 需要升级到 4.0

2. **文件路径错误**
   - 检查 `model3.json` 中的路径
   - 确保使用相对路径和正斜杠

3. **缺少文件**
   - 检查 `.moc3` 和纹理文件是否存在

**解决方法：**

```bash
# 查看应用日志
# Windows: %APPDATA%\astrbot-live2d-desktop\logs\
# macOS/Linux: ~/.config/astrbot-live2d-desktop/logs/

# 检查文件权限
ls -la models/my-model/

# 验证 JSON 格式
cat models/my-model/model3.json | jq
```

### Q: 模型动作不播放？

**可能原因：**

1. 动作文件路径错误
2. 动作文件格式错误
3. 动作组名称不匹配

**解决方法：**

检查 `model3.json` 中的 `Motions` 配置：

```json
{
  "Motions": {
    "Idle": [  // 组名必须匹配应用的动作触发逻辑
      { "File": "motions/idle.motion3.json" }
    ]
  }
}
```

### Q: 如何制作自己的 Live2D 模型？

你需要：

1. **Live2D Cubism Editor**（官方编辑器）
   - 下载：https://www.live2d.com/download/cubism/
   - 免费版有功能限制

2. **学习资源**
   - 官方教程：https://docs.live2d.com/
   - B站教程搜索："Live2D 入门"

3. **基本流程**
   - 准备 PSD 分层图
   - 导入 Cubism Editor
   - 创建网格和变形器
   - 设置参数和动作
   - 导出为 Cubism 4.0 格式

### Q: 从哪里获取免费模型？

**合法来源：**

1. Live2D 官方示例模型
2. GitHub 开源模型
3. 创作者明确允许使用的模型

**注意：**
- ⚠️ 未经授权不要使用商业模型
- ⚠️ 尊重原作者的版权和许可协议

### Q: 模型加载很慢怎么办？

**优化建议：**

1. 压缩纹理文件
2. 减少动作数量
3. 简化物理效果
4. 使用 SSD 存储模型文件

---

## 进阶技巧

### 自定义点击区域

在 `model3.json` 中定义 `HitAreas`：

```json
{
  "HitAreas": [
    { "Name": "Head", "Id": "HitAreaHead" },
    { "Name": "Body", "Id": "HitAreaBody" },
    { "Name": "Hand", "Id": "HitAreaHand" }
  ]
}
```

应用会根据点击区域触发不同的动作。

### 自定义动作组

定义特殊动作组：

```json
{
  "Motions": {
    "Idle": [...],
    "TapHead": [...],    // 点击头部触发
    "TapBody": [...],    // 点击身体触发
    "Greeting": [...],   // 问候动作
    "Farewell": [...]    // 告别动作
  }
}
```

### 批量导入模型

使用脚本批量处理：

```bash
#!/bin/bash
# import-models.sh

for dir in source-models/*/; do
  name=$(basename "$dir")
  cp -r "$dir" "public/models/$name"
  echo "Imported: $name"
done
```

---

## 相关资源

- [Live2D 官网](https://www.live2d.com/)
- [Cubism Editor 下载](https://www.live2d.com/download/cubism/)
- [官方文档](https://docs.live2d.com/)
- [pixi-live2d-display](https://github.com/guansss/pixi-live2d-display)

---

如有其他问题，请提交 Issue 或查看项目文档。
