import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDir, '..')
const resourcesDir = path.join(projectRoot, 'resources')
const sourcePath = path.resolve(process.argv[2] ?? path.join(resourcesDir, 'icon-source.svg'))
const buildDir = path.join(resourcesDir, '.icon-build')
const pngDir = path.join(buildDir, 'png')
const renderHtmlPath = path.join(buildDir, 'render.html')
const basePngPath = path.join(pngDir, '1024.png')
const iconPngPath = path.join(resourcesDir, 'icon.png')
const iconIcoPath = path.join(resourcesDir, 'icon.ico')
const iconIcnsPath = path.join(resourcesDir, 'icon.icns')
const powershellPath = path.join(
  process.env.SystemRoot ?? 'C:\\Windows',
  'System32',
  'WindowsPowerShell',
  'v1.0',
  'powershell.exe'
)

if (!fs.existsSync(sourcePath)) {
  throw new Error(`找不到图标源文件: ${sourcePath}`)
}

if (process.platform !== 'win32') {
  throw new Error('icons:generate 当前依赖 PowerShell 与 System.Drawing，仅支持在 Windows 上执行。')
}

if (!fs.existsSync(powershellPath)) {
  throw new Error(`找不到 PowerShell: ${powershellPath}`)
}

const browserPath = resolveBrowserPath()
const sizes = [16, 32, 48, 64, 128, 256, 512, 1024]

fs.rmSync(buildDir, { recursive: true, force: true })
fs.mkdirSync(pngDir, { recursive: true })

writeRenderHtml(renderHtmlPath, sourcePath)
renderBasePng({
  browserPath,
  inputUrl: pathToFileURL(renderHtmlPath).href,
  outputPath: basePngPath
})

for (const size of sizes.filter((value) => value !== 1024)) {
  resizePng({
    inputPath: basePngPath,
    size,
    outputPath: path.join(pngDir, `${size}.png`)
  })
}

fs.copyFileSync(basePngPath, iconPngPath)
writeIco(iconIcoPath, [16, 32, 48, 64, 128, 256].map((size) => path.join(pngDir, `${size}.png`)))
writeIcns(
  iconIcnsPath,
  new Map([
    ['icp4', path.join(pngDir, '16.png')],
    ['icp5', path.join(pngDir, '32.png')],
    ['icp6', path.join(pngDir, '64.png')],
    ['ic07', path.join(pngDir, '128.png')],
    ['ic08', path.join(pngDir, '256.png')],
    ['ic09', path.join(pngDir, '512.png')],
    ['ic10', path.join(pngDir, '1024.png')]
  ])
)

fs.rmSync(buildDir, { recursive: true, force: true })

console.log(`[图标] 源文件: ${sourcePath}`)
console.log(`[图标] 已生成: ${iconPngPath}`)
console.log(`[图标] 已生成: ${iconIcoPath}`)
console.log(`[图标] 已生成: ${iconIcnsPath}`)

function writeRenderHtml(outputPath, svgPath) {
  const svgBase64 = fs.readFileSync(svgPath).toString('base64')
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>
      html, body {
        width: 100%;
        height: 100%;
        margin: 0;
        overflow: hidden;
        background: transparent;
      }

      body {
        display: block;
      }

      img {
        display: block;
        width: 100vw;
        height: 100vh;
        object-fit: contain;
      }
    </style>
  </head>
  <body>
    <img alt="icon" src="data:image/svg+xml;base64,${svgBase64}" />
  </body>
</html>
`
  fs.writeFileSync(outputPath, html, 'utf8')
}

function renderBasePng({ browserPath, inputUrl, outputPath }) {
  fs.rmSync(outputPath, { force: true })

  const result = spawnSync(
    browserPath,
    [
      '--headless',
      '--disable-gpu',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-component-update',
      '--disable-sync',
      '--disable-default-apps',
      '--hide-scrollbars',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-crash-reporter',
      '--disable-crashpad-for-testing',
      '--force-device-scale-factor=1',
      '--run-all-compositor-stages-before-draw',
      '--virtual-time-budget=1000',
      '--default-background-color=00000000',
      '--window-size=1024,1024',
      `--screenshot=${outputPath}`,
      inputUrl
    ],
    { encoding: 'utf8' }
  )

  if (result.status !== 0) {
    throw new Error(`渲染 1024px PNG 失败:\n${result.stderr || result.stdout}`)
  }

  const stat = fs.statSync(outputPath)
  if (stat.size <= 0) {
    throw new Error('渲染 1024px PNG 失败: 输出文件为空')
  }
}

function resizePng({ inputPath, size, outputPath }) {
  fs.rmSync(outputPath, { force: true })

  const script = `
Add-Type -AssemblyName System.Drawing
$src = [System.Drawing.Image]::FromFile('${escapePowerShell(inputPath)}')
$bmp = New-Object System.Drawing.Bitmap(${size}, ${size})
$graphics = [System.Drawing.Graphics]::FromImage($bmp)
$graphics.Clear([System.Drawing.Color]::Transparent)
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
$graphics.DrawImage($src, 0, 0, ${size}, ${size})
$bmp.Save('${escapePowerShell(outputPath)}', [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$bmp.Dispose()
$src.Dispose()
`

  const result = spawnSync(powershellPath, ['-NoProfile', '-Command', script], { encoding: 'utf8' })
  if (result.status !== 0) {
    throw new Error(`缩放 ${size}px PNG 失败:\n${result.stderr || result.stdout}`)
  }

  const stat = fs.statSync(outputPath)
  if (stat.size <= 0) {
    throw new Error(`缩放 ${size}px PNG 失败: 输出文件为空`)
  }
}

function writeIco(outputPath, pngPaths) {
  const images = pngPaths.map((pngPath) => {
    const size = Number.parseInt(path.basename(pngPath, path.extname(pngPath)), 10)
    return {
      size,
      data: fs.readFileSync(pngPath)
    }
  })

  const header = Buffer.alloc(6 + images.length * 16)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)

  let offset = header.length
  images.forEach((image, index) => {
    const entryOffset = 6 + index * 16
    header[entryOffset] = image.size >= 256 ? 0 : image.size
    header[entryOffset + 1] = image.size >= 256 ? 0 : image.size
    header[entryOffset + 2] = 0
    header[entryOffset + 3] = 0
    header.writeUInt16LE(1, entryOffset + 4)
    header.writeUInt16LE(32, entryOffset + 6)
    header.writeUInt32LE(image.data.length, entryOffset + 8)
    header.writeUInt32LE(offset, entryOffset + 12)
    offset += image.data.length
  })

  fs.writeFileSync(outputPath, Buffer.concat([header, ...images.map((image) => image.data)]))
}

function writeIcns(outputPath, iconMap) {
  const chunks = []

  for (const [type, pngPath] of iconMap) {
    const data = fs.readFileSync(pngPath)
    const chunk = Buffer.alloc(8 + data.length)
    chunk.write(type, 0, 4, 'ascii')
    chunk.writeUInt32BE(chunk.length, 4)
    data.copy(chunk, 8)
    chunks.push(chunk)
  }

  const totalLength = 8 + chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const header = Buffer.alloc(8)
  header.write('icns', 0, 4, 'ascii')
  header.writeUInt32BE(totalLength, 4)

  fs.writeFileSync(outputPath, Buffer.concat([header, ...chunks]))
}

function resolveBrowserPath() {
  const envPath = process.env.BROWSER_PATH
  if (envPath && fs.existsSync(envPath)) {
    return envPath
  }

  const candidates =
    process.platform === 'win32'
      ? [
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
          'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        ]
      : process.platform === 'darwin'
        ? [
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
          ]
        : [
            '/usr/bin/google-chrome',
            '/usr/bin/chromium',
            '/snap/bin/chromium',
            '/usr/bin/microsoft-edge'
          ]

  const match = candidates.find((candidate) => fs.existsSync(candidate))
  if (match) {
    return match
  }

  throw new Error('找不到可用浏览器，请设置 BROWSER_PATH 指向 Edge 或 Chrome。')
}

function escapePowerShell(value) {
  return value.replace(/'/g, "''")
}
