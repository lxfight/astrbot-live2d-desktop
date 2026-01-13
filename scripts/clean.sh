#!/bin/bash

# 清理脚本 - 删除临时文件和构建产物

echo "🧹 开始清理项目..."

# 删除临时文件
echo "删除临时文件..."
rm -f tmpclaude-* *.tmp *.temp
find . -name "*.tmp" -delete 2>/dev/null
find . -name "*.temp" -delete 2>/dev/null
find . -name ".DS_Store" -delete 2>/dev/null

# 删除构建产物
if [ -d "dist" ]; then
  echo "删除构建产物..."
  rm -rf dist
fi

# 删除缓存
if [ -d ".vite" ]; then
  echo "删除 Vite 缓存..."
  rm -rf .vite
fi

if [ -d ".cache" ]; then
  echo "删除缓存..."
  rm -rf .cache
fi

# 可选：删除 node_modules（需要重新安装）
if [ "$1" = "--deep" ]; then
  echo "深度清理：删除 node_modules..."
  rm -rf node_modules
  echo "请运行 'pnpm install' 重新安装依赖"
fi

echo "✅ 清理完成！"
