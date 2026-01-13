# 贡献指南

感谢你对 AstrBot Live2D 桌面端的关注！我们欢迎各种形式的贡献。

## 目录

- [开发环境设置](#开发环境设置)
- [代码规范](#代码规范)
- [提交流程](#提交流程)
- [测试要求](#测试要求)
- [文档更新](#文档更新)

---

## 开发环境设置

### 前置要求

- **Node.js**: v18 或更高版本
- **pnpm**: v8 或更高版本（必须使用 pnpm，不支持 npm/yarn）
- **Git**: 用于版本控制

### 克隆项目

```bash
git clone https://github.com/yourusername/astrbot-live2d-desktop.git
cd astrbot-live2d-desktop
```

### 安装依赖

```bash
pnpm install
```

### 配置环境变量

复制 `.env.example` 为 `.env.local` 并根据需要修改：

```bash
cp .env.example .env.local
```

### 启动开发服务器

```bash
# 仅前端开发（浏览器模式）
pnpm dev

# 完整 Electron 应用开发
pnpm start
```

### 运行测试

```bash
# 运行所有测试
pnpm test

# 运行测试（UI 界面）
pnpm test:ui

# 生成测试覆盖率报告
pnpm test:coverage
```

---

## 代码规范

### TypeScript

- 使用严格模式（`strict: true`）
- 所有函数必须有明确的返回类型
- 优先使用 `interface` 而非 `type`（除非需要联合类型）
- 使用路径别名 `@/` 导入模块

**示例：**

```typescript
// ✅ 推荐
import { settingsService } from '@/services'

export interface User {
  id: number
  name: string
}

export function getUser(id: number): Promise<User> {
  // ...
}

// ❌ 不推荐
import { settingsService } from '../../services'

type User = {
  id: number
  name: string
}

function getUser(id) {
  // ...
}
```

### Vue 组件

- 使用 Composition API (`<script setup>`)
- 组件文件名使用 PascalCase（如 `Settings.vue`）
- Props 必须定义类型
- 使用 Pinia stores 管理状态

**示例：**

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSettingsStore } from '@/stores'

interface Props {
  title: string
  count?: number
}

const props = withDefaults(defineProps<Props>(), {
  count: 0
})

const settingsStore = useSettingsStore()
const localCount = ref(props.count)

const displayText = computed(() => {
  return `${props.title}: ${localCount.value}`
})
</script>

<template>
  <div>{{ displayText }}</div>
</template>
```

### 命名约定

- **文件名**:
  - 组件: `PascalCase.vue`
  - 工具函数: `camelCase.ts`
  - Stores: `camelCase.ts`
  - 类型定义: `camelCase.ts`

- **变量/函数**:
  - 变量: `camelCase`
  - 常量: `UPPER_SNAKE_CASE`
  - 函数: `camelCase`
  - 类: `PascalCase`

- **日志前缀**: 统一使用 `[AstrBot-L2D]`

### 注释规范

- 公共 API 必须有 JSDoc 注释
- 复杂逻辑必须有行内注释说明
- 注释使用中文

**示例：**

```typescript
/**
 * 获取用户设置
 * @param userId - 用户 ID
 * @returns 用户设置对象
 * @throws {AppError} 当用户不存在时抛出错误
 */
export async function getUserSettings(userId: number): Promise<UserSettings> {
  // 验证用户 ID 有效性
  if (userId <= 0) {
    throw new AppError({
      code: ErrorCode.INVALID_PARAMETER,
      message: '无效的用户 ID'
    })
  }

  // ...
}
```

### 错误处理

- 使用 `AppError` 类抛出业务错误
- 使用 `logger` 记录错误信息
- 用户可见的错误必须提供 `userMessage`

**示例：**

```typescript
import { AppError, ErrorCode } from '@/utils/errorHandler'
import { logger } from '@/utils/logger'

try {
  await riskyOperation()
} catch (error) {
  logger.error('操作失败', error)
  throw new AppError({
    code: ErrorCode.OPERATION_FAILED,
    message: '操作失败',
    userMessage: '抱歉，操作失败，请稍后重试',
    originalError: error
  })
}
```

---

## 提交流程

### 分支策略

- `master` - 主分支，保持稳定
- `develop` - 开发分支
- `feature/xxx` - 功能分支
- `fix/xxx` - 修复分支

### 提交信息规范

遵循 Conventional Commits 规范：

```
<type>(<scope>): <subject>

<body>

<footer>
```

**类型（type）：**

- `feat`: 新功能
- `fix`: 修复 bug
- `docs`: 文档变更
- `style`: 代码格式（不影响代码运行）
- `refactor`: 重构（既不是新功能也不是修复 bug）
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建过程或辅助工具的变动

**示例：**

```
feat(settings): 添加模型缩放设置

- 新增 modelScale 设置项
- 更新设置界面 UI
- 添加相关测试

Closes #123
```

### Pull Request 流程

1. Fork 项目到你的 GitHub 账号
2. 创建功能分支：`git checkout -b feature/my-feature`
3. 提交变更：`git commit -m "feat: add my feature"`
4. 推送到远程：`git push origin feature/my-feature`
5. 创建 Pull Request

**PR 要求：**

- 标题简洁明了
- 描述清楚变更内容和原因
- 关联相关 Issue
- 所有测试必须通过
- 代码覆盖率不能降低

---

## 测试要求

### 单元测试

- 所有工具函数必须有单元测试
- 测试覆盖率要求 ≥ 80%
- 使用 Vitest 框架

**文件位置：**

```
tests/unit/
  ├── logger.test.ts
  ├── errorHandler.test.ts
  ├── websocket.test.ts
  └── stores/
      ├── settings.test.ts
      └── conversation.test.ts
```

**示例：**

```typescript
import { describe, it, expect } from 'vitest'
import { myFunction } from '@/utils/myFunction'

describe('myFunction', () => {
  it('should return expected value', () => {
    const result = myFunction(input)
    expect(result).toBe(expected)
  })

  it('should throw error on invalid input', () => {
    expect(() => myFunction(invalid)).toThrow(AppError)
  })
})
```

### 组件测试

- 关键组件必须有测试
- 使用 `@vue/test-utils`

**示例：**

```typescript
import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import MyComponent from '@/components/MyComponent.vue'

describe('MyComponent', () => {
  it('renders properly', () => {
    const wrapper = mount(MyComponent, {
      props: { title: 'Test' }
    })
    expect(wrapper.text()).toContain('Test')
  })
})
```

---

## 文档更新

### 何时更新文档

- 添加新功能时，更新 `docs/API.md`
- 修改项目结构时，更新 `CLAUDE.md`
- 添加新依赖或工具时，更新 `README.md` 和 `DEVELOPMENT.md`

### 文档规范

- 使用中文
- 代码示例要完整可运行
- 保持文档与代码同步

---

## 代码审查

### 审查要点

- [ ] 代码符合规范
- [ ] 有适当的测试
- [ ] 文档已更新
- [ ] 无明显性能问题
- [ ] 无安全漏洞
- [ ] 提交信息规范

### 如何进行 Code Review

1. 检查代码逻辑是否正确
2. 确认是否有潜在的 bug
3. 评估代码可读性和可维护性
4. 提出建设性的改进建议
5. 批准或请求修改

---

## 发布流程

1. 更新 `package.json` 版本号
2. 更新 `CHANGELOG.md`
3. 创建 Git tag：`git tag v1.0.0`
4. 推送 tag：`git push --tags`
5. 构建发布包：`pnpm build`
6. 在 GitHub 创建 Release

---

## 获取帮助

- 查看 [DEVELOPMENT.md](../DEVELOPMENT.md) 了解架构细节
- 查看 [API.md](./API.md) 了解 API 用法
- 提交 Issue 报告 bug 或请求新功能
- 加入讨论区参与社区讨论

---

## 许可证

通过贡献代码，你同意你的贡献将在与项目相同的许可证下发布。
