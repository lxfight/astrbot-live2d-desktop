Param(
  [string]$RepoUrl = "https://github.com/Live2D/CubismWebSamples.git",
  [string]$CacheDir = "$PSScriptRoot\..\.cache\CubismWebSamples",
  [string]$DestDir = "$PSScriptRoot\..\public\models\default"
)

$ErrorActionPreference = "Stop"

Write-Host "[fetch-default-model] Repo:" $RepoUrl
Write-Host "[fetch-default-model] Cache:" $CacheDir
Write-Host "[fetch-default-model] Dest:" $DestDir

if (!(Get-Command git -ErrorAction SilentlyContinue)) {
  throw "git not found. Please install Git first."
}

# Ensure destination
New-Item -ItemType Directory -Force -Path $DestDir | Out-Null

# Clone or update cache
if (!(Test-Path $CacheDir)) {
  New-Item -ItemType Directory -Force -Path (Split-Path $CacheDir -Parent) | Out-Null
  git clone --depth 1 $RepoUrl $CacheDir
} else {
  Push-Location $CacheDir
  git fetch --depth 1 origin
  git reset --hard origin/HEAD
  Pop-Location
}

# Pick a model (prefer Hiyori, else first *.model3.json)
$modelJson = Get-ChildItem -Path $CacheDir -Recurse -Filter "*.model3.json" -File |
  Sort-Object FullName |
  Select-Object -First 1

$hiyori = Get-ChildItem -Path $CacheDir -Recurse -Filter "*Hiyori*.model3.json" -File |
  Sort-Object FullName |
  Select-Object -First 1
if ($hiyori) { $modelJson = $hiyori }

if (-not $modelJson) {
  throw "No *.model3.json found in $CacheDir"
}

$srcDir = $modelJson.Directory.FullName
Write-Host "[fetch-default-model] Selected:" $modelJson.FullName
Write-Host "[fetch-default-model] Copy from:" $srcDir

# Clean destination (keep folder)
Get-ChildItem -Path $DestDir -Force | Remove-Item -Recurse -Force

# Copy model folder contents
Copy-Item -Path (Join-Path $srcDir "*") -Destination $DestDir -Recurse -Force

# Normalize entry file name to model3.json (to match public/models/manifest.json)
$destModelJson = Join-Path $DestDir "model3.json"
Copy-Item -Path $modelJson.FullName -Destination $destModelJson -Force

Write-Host "[fetch-default-model] Done. Entry:" $destModelJson
Write-Host "[fetch-default-model] Next: pnpm tauri dev"
