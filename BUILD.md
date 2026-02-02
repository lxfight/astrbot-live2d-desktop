# 构建与打包指南

## 构建命令

### 开发构建
```bash
npm run build:fast
```
快速构建，跳过类型检查，适合开发测试。

### 生产构建
```bash
# 完整构建（包含类型检查）
npm run build

# 仅构建 Windows 安装包
npm run build:win

# 构建到目录（不打包安装程序）
npm run build:dir
```

## 构建优化

### 1. 代码分割

项目已配置自动代码分割：
- `naive-ui`: UI 组件库单独打包
- `echarts`: 图表库单独打包
- `vendor`: Vue、Pinia、Vue Router 核心库

### 2. 压缩配置

- **JavaScript**: 使用 esbuild 进行快速压缩
- **资源文件**: electron-builder 使用 maximum 压缩级别
- **ASAR**: 启用 ASAR 打包以减小文件数量

### 3. 原生依赖处理

better-sqlite3 作为原生依赖需要特殊处理：
- 自动重新编译以匹配 Electron 版本
- 从 ASAR 中解包以确保正常运行
- 构建时自动安装预编译二进制文件

## 构建产物

### 目录结构
```
release/
├── win-unpacked/              # Windows 未打包版本（约 348MB）
│   ├── AstrBot Live2D.exe    # 主程序
│   ├── resources/             # 应用资源
│   └── ...
└── AstrBot-Live2D-0.1.0-x64.exe  # Windows 安装程序（使用 build:win）
```

### 文件大小优化

当前构建大小约 348MB，主要组成：
- Electron 运行时: ~200MB
- Chromium 内核: ~100MB
- 应用代码和依赖: ~48MB

可优化方向：
1. 移除未使用的 Electron 模块
2. 使用 tree-shaking 移除未使用的代码
3. 压缩图片和静态资源

## 打包配置

### Windows 配置

支持两种打包格式：
1. **NSIS 安装程序**: 标准 Windows 安装包
   - 支持自定义安装目录
   - 创建桌面和开始菜单快捷方式
   - 支持卸载程序

2. **Portable 便携版**: 绿色免安装版本
   - 无需安装，解压即用
   - 适合移动存储设备

### 图标配置

应用图标位置：`resources/icon.ico`

要求：
- 格式：ICO
- 尺寸：256x256 或更大
- 包含多个尺寸（16x16, 32x32, 48x48, 256x256）

## 性能优化

### 构建时优化

1. **并行构建**: Vite 自动使用多核 CPU
2. **增量构建**: 仅重新构建修改的文件
3. **缓存**: 利用 node_modules/.vite 缓存

### 运行时优化

1. **懒加载**: 路由和组件按需加载
2. **代码分割**: 大型库独立打包
3. **资源压缩**: 生产环境启用 minify

## 常见问题

### 1. vue-tsc 类型检查失败

如果遇到 vue-tsc 错误，使用 `build:fast` 跳过类型检查：
```bash
npm run build:fast
```

### 2. better-sqlite3 编译失败

确保已安装 Python 和 Visual Studio Build Tools：
```bash
npm run postinstall
```

### 3. 构建速度慢

- 使用 `build:dir` 代替完整打包
- 关闭杀毒软件对 node_modules 的实时扫描
- 使用 SSD 存储项目文件

## 发布流程

1. 更新版本号（package.json）
2. 运行完整构建：`npm run build:win`
3. 测试安装程序
4. 创建 GitHub Release
5. 上传构建产物

## 环境变量

构建时可用的环境变量：

- `NODE_ENV`: 构建模式（development/production）
- `VITE_*`: 注入到客户端代码的变量

配置文件：
- `.env`: 所有环境通用
- `.env.development`: 开发环境
- `.env.production`: 生产环境
- `.env.local`: 本地覆盖（不提交到 Git）
