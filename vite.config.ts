import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import electron from 'vite-plugin-electron'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    vue(),
    electron([
      {
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            minify: process.env.NODE_ENV === 'production',
            rollupOptions: {
              // ws 不可列入 external：打包产物必须自包含，否则在缺少 node_modules/ws 的安装/便携形态下会导致主进程启动失败
              // bufferutil/utf-8-validate 是 ws 的可选原生依赖，不能打包，需 external
              external: ['electron', 'better-sqlite3', 'bufferutil', 'utf-8-validate'],
              output: {
                format: 'es'
              }
            }
          }
        }
      },
      {
        entry: 'electron/preload.ts',
        onstart(options) {
          options.reload()
        },
        vite: {
          build: {
            outDir: 'dist-electron',
            minify: process.env.NODE_ENV === 'production',
            rollupOptions: {
              output: {
                format: 'cjs'
              }
            }
          }
        }
      }
    ])
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@electron': resolve(__dirname, 'electron'),
      '@cubism-framework': resolve(__dirname, '.generated/cubism-framework/src')
    }
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler'
      }
    }
  },
  server: {
    port: 5173
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    minify: 'esbuild',
    sourcemap: process.env.NODE_ENV === 'development',
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'main.html'),
        settings: resolve(__dirname, 'settings.html'),
        welcome: resolve(__dirname, 'welcome.html'),
      },
      output: {
        manualChunks: {
          'naive-ui': ['naive-ui'],
          'echarts': ['echarts'],
          'vendor': ['vue', 'pinia']
        }
      }
    }
  }
})
