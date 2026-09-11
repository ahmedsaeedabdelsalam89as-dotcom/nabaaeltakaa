$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root
$started = Get-Date
$report = Join-Path $root 'project-governance\WINDOWS_CERTIFICATION_LAST.txt'
$lines = New-Object System.Collections.Generic.List[string]
function Add-Line([string]$s) { $lines.Add((Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + ' | ' + $s); Write-Host $s }
function Hash-File([string]$p) { if (-not (Test-Path $p)) { throw "Missing required file: $p" }; return (Get-FileHash -Path $p -Algorithm SHA256).Hash.ToLowerInvariant() }
function Get-SourceFingerprint {
  $items = New-Object System.Collections.Generic.List[object]
  foreach ($rel in @('package.json','package-lock.json','version.json','.ai-policy.yaml','PROJECT_RULES.md','src','src-tauri','scripts','phone-bridge-android')) {
    $p = Join-Path $root $rel
    if (-not (Test-Path $p)) { throw ('Missing source path: ' + $rel) }
    $it = Get-Item $p
    if ($it.PSIsContainer) {
      Get-ChildItem -Path $p -Recurse -File | Where-Object {
        $_.FullName -notmatch '[\\/]target[\\/]' -and $_.FullName -notmatch '[\\/]node_modules[\\/]'
      } | ForEach-Object { $items.Add($_) }
    } else { $items.Add($it) }
  }
  $lines = foreach ($f in ($items | Sort-Object FullName -Unique)) {
    $relp = $f.FullName.Substring($root.Length).TrimStart('\','/').Replace('\','/')
    $h = (Get-FileHash -Path $f.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    ($relp + '|' + $h)
  }
  $text = ($lines -join "`n")
  $sha = [Security.Cryptography.SHA256]::Create()
  try {
    $digest = $sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($text))
    $hex = ([BitConverter]::ToString($digest)).Replace('-','').ToLowerInvariant()
  } finally { $sha.Dispose() }
  return [pscustomobject]@{ Count = $lines.Count; Sha256 = $hex }
}
$beforeSource = $null
$proc = $null
$previousCertEnv = $env:NABA_CERTIFY_RUNTIME
try {
  Add-Line 'START Naba Fleet Windows Certification'
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js غير مثبت' }
  if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) { throw 'Rust/Cargo غير مثبت' }
  Add-Line ('Node ' + (node --version))
  Add-Line ('Cargo ' + (cargo --version))
  $expectedVersion = (Get-Content -Raw -Encoding UTF8 (Join-Path $root 'package.json') | ConvertFrom-Json).version
  Add-Line ('ExpectedVersion ' + $expectedVersion)
  $beforeSource = Get-SourceFingerprint
  Add-Line ('SourceFingerprintCount ' + $beforeSource.Count)
  Add-Line ('SourceTreeSHA256 ' + $beforeSource.Sha256)

  # Remove old output so a stale executable/installer can never satisfy this certification run.
  $releaseDir = Join-Path $root 'src-tauri\target\release'
  $oldExe = Join-Path $releaseDir 'fleet-desktop.exe'
  $oldNsis = Join-Path $releaseDir 'bundle\nsis'
  Remove-Item -Force -ErrorAction SilentlyContinue $oldExe
  Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $oldNsis
  Add-Line 'Stale release executable/NSIS artifacts removed'

  Add-Line 'GATE source/build START'
  & (Join-Path $root 'BUILD_WINDOWS.ps1')
  if ($LASTEXITCODE -ne 0) { throw "BUILD_WINDOWS.ps1 failed with exit code $LASTEXITCODE" }
  Add-Line 'GATE source/build PASS'

  $afterSource = Get-SourceFingerprint
  if ($afterSource.Count -ne $beforeSource.Count -or $afterSource.Sha256 -ne $beforeSource.Sha256) {
    throw ('Source tree mutated during build: before=' + $beforeSource.Sha256 + ' after=' + $afterSource.Sha256)
  }
  Add-Line ('Full source-tree immutability PASS (' + $afterSource.Count + ' files)')
  node .\scripts\naba-code-guardian.mjs --verify
  if ($LASTEXITCODE -ne 0) { throw 'Guardian verify failed after build' }

  $exe = Join-Path $root 'src-tauri\target\release\fleet-desktop.exe'
  if (-not (Test-Path $exe)) { throw 'release executable not found' }
  $exeItem = Get-Item $exe
  if ($exeItem.LastWriteTime -lt $started.AddSeconds(-2)) { throw 'release executable timestamp predates this certification run' }
  $exeHash = (Get-FileHash -Path $exe -Algorithm SHA256).Hash.ToLowerInvariant()
  Add-Line ('ExeSHA256 ' + $exeHash)

  $installer = Get-ChildItem -Path (Join-Path $root 'src-tauri\target\release\bundle\nsis') -Filter '*.exe' -File -ErrorAction Stop | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $installer) { throw 'NSIS installer not found' }
  if ($installer.LastWriteTime -lt $started.AddSeconds(-2)) { throw 'NSIS installer timestamp predates this certification run' }
  Add-Line ('Installer ' + $installer.FullName)
  $installerHash = (Get-FileHash -Path $installer.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
  Add-Line ('InstallerSHA256 ' + $installerHash)

  $runtimeReport = Join-Path $env:LOCALAPPDATA 'NabaFleetSystem\certification\runtime-self-test.json'
  Remove-Item -Force -ErrorAction SilentlyContinue $runtimeReport
  $runtimeStart = Get-Date
  $env:NABA_CERTIFY_RUNTIME = '1'
  $proc = Start-Process -FilePath $exe -PassThru
  $deadline = (Get-Date).AddSeconds(35)
  while ((Get-Date) -lt $deadline -and -not (Test-Path $runtimeReport)) {
    Start-Sleep -Milliseconds 500
    if ($proc.HasExited) { throw ('Runtime startup failed; process exited with code ' + $proc.ExitCode) }
  }
  if (-not (Test-Path $runtimeReport)) { throw 'Runtime self-test marker not created within 35 seconds' }
  $reportItem = Get-Item $runtimeReport
  if ($reportItem.LastWriteTime -lt $runtimeStart.AddSeconds(-2)) { throw 'Runtime report is stale' }
  $runtime = Get-Content -Raw -Encoding UTF8 $runtimeReport | ConvertFrom-Json
  if ($runtime.schema -ne 1) { throw ('Unsupported runtime report schema: ' + $runtime.schema) }
  if ([string]::IsNullOrWhiteSpace($runtime.version) -or $runtime.version -ne $expectedVersion) { throw ('Runtime version mismatch: expected ' + $expectedVersion + ', got ' + $runtime.version) }
  Add-Line ('RuntimeVersion ' + $runtime.version)
  if (-not $runtime.ok) { throw ('Runtime NABA self-test failed: ' + (($runtime.error, ($runtime.checks -join ' | ')) -join ' ')) }
  if (-not $runtime.checks -or $runtime.checks.Count -ne 5) { throw 'Runtime NABA self-test did not execute all 5 core commands' }
  foreach ($check in $runtime.checks) { if (-not ([string]$check).StartsWith('✅')) { throw ('Runtime check did not pass: ' + [string]$check) } }
  Add-Line ('Runtime NABA self-test PASS (' + $runtime.checks.Count + '/5 commands)')
  Add-Line 'PASS Windows source/build/WebView/NABA certification'
  $exitCode = 0
} catch {
  Add-Line ('FAIL ' + $_.Exception.Message)
  $exitCode = 1
} finally {
  if ($proc -and -not $proc.HasExited) { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue }
  if ($null -eq $previousCertEnv) { Remove-Item Env:NABA_CERTIFY_RUNTIME -ErrorAction SilentlyContinue } else { $env:NABA_CERTIFY_RUNTIME = $previousCertEnv }
  $elapsed = [math]::Round(((Get-Date) - $started).TotalSeconds, 1)
  Add-Line ('ElapsedSeconds ' + $elapsed)
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $report) | Out-Null
  [IO.File]::WriteAllLines($report, $lines, [Text.UTF8Encoding]::new($true))
  Write-Host ('Report: ' + $report) -ForegroundColor Cyan
}
exit $exitCode
