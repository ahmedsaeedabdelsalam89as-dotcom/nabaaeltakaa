$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root
$started = Get-Date
$report = Join-Path $root 'project-governance\WINDOWS_CERTIFICATION_LAST.txt'
$lines = New-Object System.Collections.Generic.List[string]
function Add-Line([string]$s) { $lines.Add((Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + ' | ' + $s); Write-Host $s }
try {
  Add-Line 'START Naba Fleet Windows Certification'
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js غير مثبت' }
  if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) { throw 'Rust/Cargo غير مثبت' }
  Add-Line ('Node ' + (node --version))
  Add-Line ('Cargo ' + (cargo --version))
  Add-Line 'GATE source/build START'
  & (Join-Path $root 'BUILD_WINDOWS.ps1')
  if ($LASTEXITCODE -ne 0) { throw "BUILD_WINDOWS.ps1 failed with exit code $LASTEXITCODE" }
  Add-Line 'GATE source/build PASS'
  node .\scripts\naba-code-guardian.mjs --verify
  if ($LASTEXITCODE -ne 0) { throw 'Guardian verify failed after build' }
  $exe = Join-Path $root 'src-tauri\target\release\fleet-desktop.exe'
  if (-not (Test-Path $exe)) { throw 'release executable not found' }
  $installer = Get-ChildItem -Path (Join-Path $root 'src-tauri\target\release\bundle\nsis') -Filter '*.exe' -File -ErrorAction Stop | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $installer) { throw 'NSIS installer not found' }
  Add-Line ('Installer ' + $installer.FullName)
  $installerHash = (Get-FileHash -Path $installer.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
  Add-Line ('InstallerSHA256 ' + $installerHash)
  $runtimeReport = Join-Path $env:LOCALAPPDATA 'NabaFleetSystem\certification\runtime-self-test.json'
  Remove-Item -Force -ErrorAction SilentlyContinue $runtimeReport
  $previousCertEnv = $env:NABA_CERTIFY_RUNTIME
  $env:NABA_CERTIFY_RUNTIME = '1'
  $proc = Start-Process -FilePath $exe -PassThru
  $deadline = (Get-Date).AddSeconds(35)
  while ((Get-Date) -lt $deadline -and -not (Test-Path $runtimeReport)) {
    Start-Sleep -Milliseconds 500
    if ($proc.HasExited) { throw ('Runtime startup failed; process exited with code ' + $proc.ExitCode) }
  }
  if ($null -eq $previousCertEnv) { Remove-Item Env:NABA_CERTIFY_RUNTIME -ErrorAction SilentlyContinue } else { $env:NABA_CERTIFY_RUNTIME = $previousCertEnv }
  if (-not (Test-Path $runtimeReport)) { throw 'Runtime self-test marker not created within 35 seconds' }
  $runtime = Get-Content -Raw -Encoding UTF8 $runtimeReport | ConvertFrom-Json
  if (-not $runtime.ok) { throw ('Runtime NABA self-test failed: ' + (($runtime.error, ($runtime.checks -join ' | ')) -join ' ')) }
  if (-not $runtime.checks -or $runtime.checks.Count -ne 5) { throw 'Runtime NABA self-test did not execute all 5 core commands' }
  Add-Line ('Runtime NABA self-test PASS (' + $runtime.checks.Count + '/5 commands)')
  Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
  Add-Line 'PASS Windows source/build/WebView/NABA certification'
  $exitCode = 0
} catch {
  Add-Line ('FAIL ' + $_.Exception.Message)
  $exitCode = 1
} finally {
  $elapsed = [math]::Round(((Get-Date) - $started).TotalSeconds, 1)
  Add-Line ('ElapsedSeconds ' + $elapsed)
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $report) | Out-Null
  [IO.File]::WriteAllLines($report, $lines, [Text.UTF8Encoding]::new($true))
  Write-Host ('Report: ' + $report) -ForegroundColor Cyan
}
exit $exitCode
