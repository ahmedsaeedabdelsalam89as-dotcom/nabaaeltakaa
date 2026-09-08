@echo off
setlocal
cd /d "%~dp0"
echo ============================================================
echo NABA Fleet System - One Click Windows Certification
echo ============================================================
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0NABA_FINAL_WINDOWS_CERTIFY.ps1"
set "EC=%ERRORLEVEL%"
echo.
if "%EC%"=="0" (
  echo CERTIFICATION PASS
) else (
  echo CERTIFICATION FAILED - exit code %EC%
  echo Report: %~dp0project-governance\WINDOWS_CERTIFICATION_LAST.txt
)
echo.
echo Press any key to close this window.
pause >nul
exit /b %EC%
