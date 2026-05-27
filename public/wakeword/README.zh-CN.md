# 语音唤醒资源（离线）

将 Porcupine Web 运行时和模型文件放置在此处，以支持完全离线的语音唤醒检测。

所需路径：

- `public/wakeword/porcupine/porcupine.js`
  - 本地 Porcupine Web ESM 包（必须导出包含 `create()` 方法的 `Porcupine` 或 `PorcupineWorker`）。
- `public/wakeword/porcupine_params.pv`
  - Porcupine 模型参数文件。
- `public/wakeword/keywords/<keyword>.ppn`
  - 每个配置的唤醒关键词对应一个关键词模型文件。

默认关键词路径规则：

- 唤醒词如 `xiao_zhushou` 映射到 `./wakeword/keywords/xiao_zhushou.ppn`
- 如果配置的关键词已以 `.ppn` 结尾，则映射到 `./wakeword/keywords/<value>`
- 绝对路径（以 `/` 开头）直接使用。

环境变量（可选）：

- `VITE_PORCUPINE_ACCESS_KEY`
- `VITE_PORCUPINE_MODULE_PATH`（默认：`./wakeword/porcupine/porcupine.js`）
- `VITE_PORCUPINE_MODEL_PATH`（默认：`./wakeword/porcupine_params.pv`）
- `VITE_PORCUPINE_KEYWORD_BASE_PATH`（默认：`./wakeword/keywords`）

如果文件缺失，应用会显示明确的错误提示并继续运行，只是不启用语音唤醒监听。
