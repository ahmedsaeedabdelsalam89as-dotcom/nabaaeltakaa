$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root
Write-Host 'Naba Fleet System - Windows Production Build' -ForegroundColor Cyan
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js غير مثبت' }
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) { throw 'Rust/Cargo غير مثبت' }
npm ci
if ($LASTEXITCODE -ne 0) { throw "npm ci failed with exit code $LASTEXITCODE" }
npm run test:all
if ($LASTEXITCODE -ne 0) { throw "test:all failed with exit code $LASTEXITCODE" }
# Normalize Cargo.lock on the actual Windows/Rust toolchain first.
# This is intentional for certification bootstrap because Cargo can require
# a lock refresh across toolchain/platform resolution even when Cargo.toml is unchanged.
cargo check --manifest-path src-tauri/Cargo.toml
if ($LASTEXITCODE -ne 0) { throw "cargo lock normalization/check failed with exit code $LASTEXITCODE" }
node scripts/naba-code-guardian.mjs --snapshot
if ($LASTEXITCODE -ne 0) { throw "Guardian snapshot after Cargo normalization failed with exit code $LASTEXITCODE" }
node scripts/naba-code-guardian.mjs --verify
if ($LASTEXITCODE -ne 0) { throw "Guardian verify failed with exit code $LASTEXITCODE" }
cargo check --manifest-path src-tauri/Cargo.toml --locked
if ($LASTEXITCODE -ne 0) { throw "cargo locked re-check failed with exit code $LASTEXITCODE" }
$hasKey = -not [string]::IsNullOrWhiteSpace($env:TAURI_SIGNING_PRIVATE_KEY)
if ($hasKey) {
  Write-Host 'Signing key detected: building updater artifacts.' -ForegroundColor Green
  npm run tauri build
  if ($LASTEXITCODE -ne 0) { throw "Tauri build failed with exit code $LASTEXITCODE" }
} else {
  Write-Host 'No signing key: building installer only (no updater artifacts).' -ForegroundColor Yellow
  npm run tauri build -- --config src-tauri/tauri.no-updater.conf.json
  if ($LASTEXITCODE -ne 0) { throw "Tauri installer build failed with exit code $LASTEXITCODE" }
}
$bundles = Get-ChildItem -Path 'src-tauri\target\release\bundle\nsis' -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.Extension -eq '.exe' }
if (-not $bundles) { throw 'لم يتم العثور على NSIS Installer' }
$bundles | ForEach-Object { Write-Host ('Installer: ' + $_.FullName) -ForegroundColor Green }
