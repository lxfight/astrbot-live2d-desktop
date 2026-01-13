import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'

const shim = (p: string) => path.resolve(process.cwd(), p)

export default defineConfig({
  plugins: [vue()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/**']
    }
  },
  resolve: {
    alias: {
      // 路径别名
      '@': path.resolve(__dirname, './src'),
      // 为 Node.js 内置模块提供空实现
      'path': 'path-browserify',
      'fs': shim('src/shims/fs.ts'),
      // Vite 不会为 Node 核心模块自动 polyfill；Pixi(@pixi/utils) 在浏览器侧会用到 url.parse/format/resolve
      'url': shim('src/shims/url.ts'),
      // earcut 已通过 optimizeDeps.needsInterop 处理 CJS interop，无需 shim
    }
  },
  optimizeDeps: {
    // 排除 pixi-live2d-display，让它使用全局的 PIXI
    exclude: ['pixi-live2d-display'],
    // eventemitter3 为 CJS 包，@pixi/utils 以 default import 引用；需要预构建以获得 ESM/interop 导出
    include: ['eventemitter3', 'earcut'],
    // 某些环境下需要显式 interop 才会生成 default 导出
    needsInterop: ['eventemitter3', 'earcut'],
    esbuildOptions: {
      // 定义全局变量以兼容某些库
      define: {
        global: 'globalThis'
      }
    }
  },
  build: {
    outDir: 'dist',
    commonjsOptions: {
      transformMixedEsModules: true,
      defaultIsModuleExports: true
    },
    rollupOptions: {
      input: {
        main: './index.html'
      },
      output: {
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]',
        globals: {
          'pixi.js': 'PIXI'
        }
      }
    }
  }
})
