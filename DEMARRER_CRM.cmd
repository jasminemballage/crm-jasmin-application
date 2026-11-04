@echo off
setlocal
cd /d "%~dp0"
title CRM Jasmin - Demonstration locale
set "CRM_LOCAL_DEMO=1"
set "NEXT_TELEMETRY_DISABLED=1"
if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" (
  set "JASMIN_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
) else (
  where node >nul 2>nul
  if errorlevel 1 (
    echo Node.js 22 ou plus recent est necessaire. Revenez dans Codex pour terminer l'installation.
    pause
    exit /b 1
  )
  set "JASMIN_NODE=node"
)
if not exist "node_modules\next\dist\bin\next" (
  echo Les dependances ne sont pas installees. Revenez dans Codex pour terminer l'installation.
  pause
  exit /b 1
)
echo.
echo CRM JASMIN - Donnees fictives uniquement
echo.
echo Ouvrez http://127.0.0.1:3000 dans votre navigateur apres le message Ready.
echo Laissez cette fenetre ouverte pendant vos essais. Ctrl+C pour arreter.
echo.
"%JASMIN_NODE%" "node_modules\next\dist\bin\next" dev --hostname 127.0.0.1 --port 3000 --webpack
if errorlevel 1 pause
