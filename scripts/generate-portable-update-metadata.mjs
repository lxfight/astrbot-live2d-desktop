import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
const releaseDir = path.join(projectRoot, 'release')
const packageJsonPath = path.join(projectRoot, 'package.json')
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))

const cliArgs = process.argv.slice(2)
const archArgFromOption = cliArgs
  .find((arg) => arg.startsWith('--arch='))
  ?.slice('--arch='.length)
const archArgFromFlag = cliArgs.find((arg) => arg === '--x64' || arg === '--arm64')?.slice(2)
const archArg = archArgFromOption || archArgFromFlag || null

const escapedVersion = packageJson.version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const portablePattern = new RegExp(
  `^astrbot-live2d-desktop-v${escapedVersion}-portable-(x64|arm64)\\.exe$`,
  'i'
)

function toSha512(filePath) {
  const hash = createHash('sha512')
  hash.update(fs.readFileSync(filePath))
  return hash.digest('base64')
}

function buildMetadata(fileName, filePath) {
  const stat = fs.statSync(filePath)
  const sha512 = toSha512(filePath)
  return [
    `version: ${packageJson.version}`,
    'files:',
    `  - url: ${fileName}`,
    `    sha512: ${sha512}`,
    `    size: ${stat.size}`,
    `path: ${fileName}`,
    `sha512: ${sha512}`,
    `releaseDate: '${stat.mtime.toISOString()}'`,
    ''
  ].join('\n')
}

if (!fs.existsSync(releaseDir)) {
  console.log('[META] 未找到 release 目录，跳过便携版更新元数据生成')
  process.exit(0)
}

if (!archArg && process.platform !== 'win32') {
  console.log('[META] 当前不是 Windows 打包环境，跳过便携版更新元数据生成')
  process.exit(0)
}

const portableArtifacts = fs
  .readdirSync(releaseDir, { withFileTypes: true })
  .filter((entry) => entry.isFile() && portablePattern.test(entry.name))
  .map((entry) => entry.name)
  .filter((fileName) => {
    if (!archArg) {
      return true
    }
    return fileName.toLowerCase().endsWith(`portable-${archArg.toLowerCase()}.exe`)
  })

if (portableArtifacts.length === 0) {
  console.log('[META] 未找到匹配的便携版产物，跳过便携版更新元数据生成')
  process.exit(0)
}

for (const fileName of portableArtifacts) {
  const match = fileName.match(portablePattern)
  if (!match) {
    continue
  }

  const arch = match[1].toLowerCase()
  const filePath = path.join(releaseDir, fileName)
  const metadataPath = path.join(releaseDir, `latest-portable-${arch}.yml`)
  fs.writeFileSync(metadataPath, buildMetadata(fileName, filePath), 'utf8')
  console.log(`[META] 已生成 ${path.basename(metadataPath)} -> ${fileName}`)
}
