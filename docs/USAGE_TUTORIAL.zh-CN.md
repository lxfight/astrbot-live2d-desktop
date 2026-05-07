# AstrBot Live2D Desktop 使用教程

本文档面向桌面端用户，介绍从连接到日常使用的完整流程。

## 1. 开始前准备

请先确认：

- 已安装并启用 AstrBot 的 `astrbot-live2d-adapter` 适配器。
- 已拿到适配器使用的认证密钥（`auth_token`）。
- 桌面端和 AstrBot 服务端网络可达（本机或局域网/公网）。

> 如果适配器没有手动配置 `auth_token`，会自动生成并保存到：
> `AstrBot/data/plugin_data/astrbot-live2d-adapter/live2d_auth_token.txt`

## 2. 首次连接（必做）

1. 启动桌面端，打开「设置 -> 连接」。
2. 填写服务器地址，例如：
   - 本机：`ws://127.0.0.1:9090/astrbot/live2d`
   - 远程服务器：`ws://<服务器IP>:9090/astrbot/live2d`
3. 填写认证令牌（必填，需与适配器端 `auth_token` 一致）。
4. 点击「连接」。

连接成功后，令牌会保存在本地，下次启动无需重复输入。

## 3. 导入模型

1. 在主窗口点击「导入模型」。
2. 选择包含 `.model3.json` 的模型目录。
3. 等待加载完成。

导入成功后，模型与位置会自动记忆。

### 3.1 当前支持的模型入口

- 只支持 Cubism 3/4 的 `.model3.json` 作为模型入口。
- 不支持 Cubism 2 `.model.json`。如果目录中只有 `.model.json`，导入会直接失败。
- 如果同一目录里同时存在多个 `.model3.json`，应用会按内置启发式规则选择一个优先入口，通常优先根目录、与目录名更接近的文件；复杂目录建议只保留明确的主入口文件。

### 3.2 动作与表情的自动发现范围

桌面端不会只盯着 `.model3.json` 一种来源。当前版本会按以下顺序补齐模型动作与表情：

1. `.model3.json` 中 `FileReferences` 的标准声明。
2. 模型目录下的 `.vtube.json` companion 声明。
3. 模型目录递归扫描得到的 `.motion3.json` 与 `.exp3.json` fallback。

这意味着：

- 标准声明优先级最高。
- `.vtube.json` 只作为补充来源使用，不是完整的 VTube Studio 配置兼容层。
- 目录扫描只是兼容兜底。即使文件被扫描到，也不代表它们具备和标准声明完全一致的语义。

### 3.3 `astrbot.live2d.profile.json` 的作用

如果模型目录下存在 `astrbot.live2d.profile.json`，桌面端会自动尝试加载它。

它的作用不是替代 `.model3.json`，而是给已经发现的表情补充这些元信息：

- `aliases`：表情目录别名
- `tags`：语义标签
- `semanticPresets`：语义预设到表情 ID 的映射

如果这个文件不存在、读取失败或内容无效，模型仍可继续加载，只是不会获得这部分附加语义信息。

## 4. 日常使用

### 4.1 文本对话

- 右键模型打开圆盘菜单，点击「对话」。
- 输入文字并发送，服务端回复会以气泡/动作/语音形式展示。

### 4.1.1 表情能力边界

- `exp3`：当前表情目录与组合能力以 `.exp3.json` 解析结果为基础。只有成功解析且包含有效参数的表情，才会进入 `combo` / `semantic` 等参数化能力构建；解析失败或无有效参数时，若原生表情加载成功，仍可能以单表情回退方式可用。
- `combo`：支持一次组合多个表情并按权重叠加，但如果多个表情命中同类冲突参数，最终效果会按运行时冲突决策收敛，不是无条件全量混合。
- `semantic`：支持按标签触发表情，如 `happy`、`sad`、`angry`、`thinking`、`neutral`、`speaking` 等，但只有已发现且成功解析出参数的表情才会参与语义映射，命中结果依赖模型文件名、参数名与 `astrbot.live2d.profile.json` 的标签配置。
- 仅通过目录扫描发现的表情，默认不会自动开放完整语义标签；通常需要在 `astrbot.live2d.profile.json` 中显式配置 `tags` 或 `semanticPresets`，语义表情能力才会稳定。

### 4.2 录音发送

- 在输入区按住麦克风按钮开始录音，松开后自动发送。
- 也可在设置中配置全局录音快捷键。

### 4.3 语音唤醒（计划中）

- 当前版本暂未开放语音唤醒入口。
- 下个版本会在方案稳定后重新引入。

### 4.4 历史与统计

- 右键模型 ->「历史」可查看聊天记录、资源使用、统计图表。

## 5. 常见问题

### 5.1 提示“认证失败”或无法连接

- 检查桌面端令牌是否与适配器 `auth_token` 完全一致。
- 检查地址是否包含正确路径：`/astrbot/live2d`。
- 检查服务端端口是否开放（云服务器场景）。

### 5.2 连接后很快断开

- 常见原因是令牌错误或服务端策略拒绝。
- 先在 AstrBot 端执行 `/live2d.status` 与 `/live2d.config` 查看状态。

### 5.3 发送图片/语音失败

- 默认情况下，资源接口与 WebSocket 共用同一服务地址和端口；先检查服务端 `9090` 是否可达。
- 若你手动使用了高级资源设置或旧双端口模式，再检查对应资源地址、端口与令牌。

### 5.4 模型导入成功，但动作或表情不完整

- 先检查 `.model3.json` 是否已正确声明 `Motions` 与 `Expressions`。
- 如果依赖 `.vtube.json` companion，确认其中引用的文件路径真实存在。
- 如果依赖目录扫描 fallback，确认 `.motion3.json` / `.exp3.json` 确实位于模型目录或其子目录内。
- 如果语义表情不符合预期，优先检查 `astrbot.live2d.profile.json` 是否为对应表情配置了 `tags` 或 `semanticPresets`。

## 6. 推荐阅读

- 适配器教程（含云服务器防火墙与安全建议）：
  `AstrBot/data/plugins/astrbot-live2d-adapter/docs/TUTORIAL.zh-CN.md`
- 桥接协议文档：
  `AstrBot/data/plugins/astrbot-live2d-adapter/docs/API.md`
