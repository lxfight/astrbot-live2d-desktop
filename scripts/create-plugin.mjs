/**
 * 插件脚手架：生成一个新的 AstrBot 插件目录
 * 用法：node scripts/create-plugin.mjs <plugin-id> [输出目录]
 *   plugin-id  必须匹配插件 id 规则（小写字母/数字开头，含 -/_，长度 2-64）
 *   输出父目录 默认当前工作目录，插件生成到 <父目录>/<plugin-id>
 * 生成内容：manifest.json（清单骨架）、index.js（零构建入口示例）、README.md
 */

import fs from 'node:fs'
import path from 'node:path'

const PLUGIN_ID_PATTERN = /^[a-z0-9][a-z0-9-_]{1,63}$/

function fail(message) {
  console.error(`[插件脚手架] ${message}`)
  process.exit(1)
}

const pluginId = process.argv[2]
if (!pluginId) {
  fail('缺少插件 id，用法：node scripts/create-plugin.mjs <plugin-id> [输出目录]')
}
if (!PLUGIN_ID_PATTERN.test(pluginId)) {
  fail(`非法插件 id "${pluginId}"：须以小写字母/数字开头，仅含小写字母、数字、-、_，长度 2-64`)
}

const parentDirectory = path.resolve(process.argv[3] ?? '.')
const targetDirectory = path.join(parentDirectory, pluginId)
if (fs.existsSync(targetDirectory) && fs.readdirSync(targetDirectory).length > 0) {
  fail(`目标目录已存在且非空: ${targetDirectory}`)
}

const displayName = pluginId
  .split(/[-_]/)
  .map(part => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ')

const manifest = {
  id: pluginId,
  name: displayName,
  version: '1.0.0',
  description: '插件描述：安装后可在设置 → 高级 → 插件中心启用。',
  author: 'your-name',
  entry: 'index.js',
  minAppVersion: '1.0.0',
  permissions: ['storage', 'events'],
  settings: [
    {
      key: 'greeting',
      kind: 'text',
      label: '问候语',
      description: '启动时打印的问候语',
      defaultValue: `你好，我是 ${displayName}~`
    }
  ],
  subscriptions: ['message:received']
}

const entry = `/**
 * ${displayName} 插件入口
 * 宿主注入的 api 对象形状见 @astrbot/plugin-sdk 的 HostApi 类型。
 * 零构建：manifest.json 与 index.js 放入同一目录即可安装。
 *
 * 可选的 JSDoc 类型提示（编辑器补全，运行时不生效）：
 * @param {import('@astrbot/plugin-sdk').HostApi} api
 */
module.exports = function main(api) {
  api.log.info('${pluginId} 启动')

  // 订阅宿主事件：收到消息时打印（需 manifest.subscriptions 声明）
  api.events.on('message:received', payload => {
    api.log.info('收到消息事件:', payload)
  })

  return {
    onDisable() {
      api.log.info('${pluginId} 已停用')
    }
  }
}
`

const readme = `# ${displayName}

AstrBot Live2D 桌面端插件（由脚手架生成）。

## 安装

将本目录复制到桌面端的插件根目录，或在设置 → 高级 → 插件中心选择本目录安装。

## 开发

- \`manifest.json\`：清单（id、权限、设置项 schema、事件订阅、托盘菜单）
- \`index.js\`：入口，导出 \`(api) => void | { onDisable? }\` 函数
- 宿主注入的 \`api\` 能力由 \`permissions\` 白名单决定

类型参考：安装 \`@astrbot/plugin-sdk\` 后可用 JSDoc 获得 HostApi 补全。
`

fs.mkdirSync(targetDirectory, { recursive: true })
fs.writeFileSync(
  path.join(targetDirectory, 'manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`
)
fs.writeFileSync(path.join(targetDirectory, 'index.js'), entry)
fs.writeFileSync(path.join(targetDirectory, 'README.md'), readme)

console.log(`[插件脚手架] 已生成插件 "${pluginId}" → ${targetDirectory}`)
console.log('[插件脚手架] 下一步：编辑 manifest.json 完善描述，然后在设置 → 高级 → 插件中心安装')
