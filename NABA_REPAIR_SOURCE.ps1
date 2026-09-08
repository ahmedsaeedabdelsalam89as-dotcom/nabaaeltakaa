$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
node .\scripts\naba-code-guardian.mjs --repair
npm run test:all
node .\scripts\naba-code-guardian.mjs --verify
Write-Host 'NABA Code Guardian: source repaired and regression gate passed.' -ForegroundColor Green
