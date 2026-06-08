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
        welcome: resolve(__dirname, 'welcome.html')
      },
      output: {
        manualChunks(id) {
          // Cubism Framework - 独立分块
          if (id.includes('.generated/cubism-framework')) {
            return 'cubism-framework'
          }

          // Naive UI - 独立分块
          if (id.includes('node_modules/naive-ui')) {
            return 'naive-ui'
          }

          // ECharts - 独立分块
          if (id.includes('node_modules/echarts')) {
            return 'echarts'
          }

          // Vue 核心库
          if (
            id.includes('node_modules/vue') ||
            id.includes('node_modules/@vue') ||
            id.includes('node_modules/pinia')
          ) {
            return 'vue-vendor'
          }

          // 工具库
          if (
            id.includes('node_modules/axios') ||
            id.includes('node_modules/date-fns') ||
            id.includes('node_modules/uuid')
          ) {
            return 'utils'
          }

          // 其他 node_modules - 通用 vendor
          if (id.includes('node_modules')) {
            return 'vendor'
          }
        },
        // 优化资源文件名
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]'
      }
    },
    // 优化构建性能
    target: 'esnext',
    reportCompressedSize: false // 禁用 gzip 大小报告，加快构建
  }
})
