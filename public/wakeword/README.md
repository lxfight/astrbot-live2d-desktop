# Wake Word Assets (Offline)

Place Porcupine Web runtime and model files here so wake word detection works fully offline.

Required paths:

- `public/wakeword/porcupine/porcupine.js`
  - Local Porcupine Web ESM bundle (must export `Porcupine` or `PorcupineWorker` with `create()`).
- `public/wakeword/porcupine_params.pv`
  - Porcupine model parameters file.
- `public/wakeword/keywords/<keyword>.ppn`
  - One keyword model file per configured wake keyword.

Default keyword path rule:

- A wake keyword like `xiao_zhushou` maps to `./wakeword/keywords/xiao_zhushou.ppn`
- If the configured keyword already ends with `.ppn`, it maps to `./wakeword/keywords/<value>`
- Absolute paths (starting with `/`) are used directly.

Environment variables (optional):

- `VITE_PORCUPINE_ACCESS_KEY`
- `VITE_PORCUPINE_MODULE_PATH` (default: `./wakeword/porcupine/porcupine.js`)
- `VITE_PORCUPINE_MODEL_PATH` (default: `./wakeword/porcupine_params.pv`)
- `VITE_PORCUPINE_KEYWORD_BASE_PATH` (default: `./wakeword/keywords`)

If files are missing, the app will show a clear error and keep running without wake word listening.
