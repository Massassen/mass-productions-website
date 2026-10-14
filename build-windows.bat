@echo off
rem Double-click this file to rebuild the website into the "public" folder.
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
	echo Node.js is not installed. Get the LTS version from https://nodejs.org and try again.
	pause
	exit /b 1
)
node build.mjs
echo.
pause
