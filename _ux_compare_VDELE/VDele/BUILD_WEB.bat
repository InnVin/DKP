@echo off
chcp 65001 >nul 2>&1
title VDele - Web Build

echo.
echo ========================================
echo   VDele - Build web assets for Android
echo ========================================
echo.

cd /d "%~dp0escrow_proj"
if not exist "package.json" (
    echo ERROR: escrow_proj folder not found!
    pause
    exit /b 1
)

echo [1/5] Backup originals...
if exist "src\app\routes.tsx" copy /y "src\app\routes.tsx" "src\app\routes.tsx.bak" >nul 2>&1
if exist "vite.config.ts" copy /y "vite.config.ts" "vite.config.ts.bak" >nul 2>&1

echo [2/5] Apply Android patches...
copy /y "%~dp0web_patches\routes.android.tsx" "src\app\routes.tsx" >nul
copy /y "%~dp0web_patches\vite.config.android.ts" "vite.config.ts" >nul

echo [3/5] Install dependencies...
where pnpm >nul 2>&1
if %errorlevel%==0 (
    call pnpm install
) else (
    where npm >nul 2>&1
    if %errorlevel%==0 (
        echo pnpm not found, using npm...
        call npm install
    ) else (
        echo ERROR: npm/pnpm not found! Install Node.js
        goto :restore
    )
)

echo [4/5] Build bundle...
where pnpm >nul 2>&1
if %errorlevel%==0 (
    call pnpm build
) else (
    call npm run build
)

if not exist "dist\index.html" (
    echo.
    echo ERROR: Build failed!
    goto :restore
)

echo [5/5] Copy to Android assets...
if exist "%~dp0app\src\main\assets\www" rmdir /s /q "%~dp0app\src\main\assets\www"
mkdir "%~dp0app\src\main\assets\www"
xcopy /s /e /y /q "dist\*" "%~dp0app\src\main\assets\www\" >nul

echo.
echo ========================================
echo   DONE! Now in Android Studio:
echo   Build -- Rebuild Project
echo ========================================
echo.

:restore
if exist "src\app\routes.tsx.bak" move /y "src\app\routes.tsx.bak" "src\app\routes.tsx" >nul 2>&1
if exist "vite.config.ts.bak" move /y "vite.config.ts.bak" "vite.config.ts" >nul 2>&1
pause
