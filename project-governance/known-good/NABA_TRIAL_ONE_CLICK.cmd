@echo off
setlocal
cd /d "%~dp0"
echo ============================================================
echo NABA Fleet 1.13.13-RC - One Click Trial Gate
echo ============================================================
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0NABA_FINAL_WINDOWS_CERTIFY.ps1"
set "EC=%ERRORLEVEL%"
if not "%EC%"=="0" (
  echo.
  echo TRIAL BLOCKED - certification did not pass.
  echo Review: %~dp0project-governance\WINDOWS_CERTIFICATION_LAST.txt
  pause
  exit /b %EC%
)
set "EXE=%~dp0src-tauri\target\release\fleet-desktop.exe"
if not exist "%EXE%" (
  echo Certified executable not found: %EXE%
  pause
  exit /b 2
)
echo.
echo Certification PASS. Launching the exact certified executable...
start "NABA Fleet Trial" "%EXE%"
exit /b 0
