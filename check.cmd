@echo off
REM Copyright (c) 2026 Tailoredsoft. All rights reserved. Proprietary - see LICENSE.
REM
REM Runs the same checks CI runs, then serves the app so you can look at it.
REM Usage:  check.cmd          just the checks
REM         check.cmd serve    checks, then serve on http://localhost:8000

cd /d "%~dp0"

node check.js
if errorlevel 1 (
  echo.
  echo Checks failed - fix the above before pushing.
  exit /b 1
)

if /i "%1"=="serve" (
  node serve.js
)
