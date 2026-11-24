@echo off
chcp 1252 >nul
:: Upload update script for Visibility Browser
:: Usage: upload-update.bat [version]
:: Example: upload-update.bat 2.0.0

set VERSION=%1
if "%VERSION%"=="" (
    echo Usage: upload-update.bat [version]
    echo Example: upload-update.bat 2.0.0
    exit /b 1
)

set VPS_IP=api.gomp.su
set VPS_USER=root
set REMOTE_PATH=/var/www/updates
set LOCAL_DIR=dist

echo ========================================
echo Uploading update v%VERSION% to VPS
echo ========================================

:: Check if files exist
if not exist "%LOCAL_DIR%\latest.yml" (
    echo ERROR: %LOCAL_DIR%\latest.yml not found!
    echo Run: npm run build
    exit /b 1
)

echo [1/3] Uploading latest.yml...
scp "%LOCAL_DIR%\latest.yml" %VPS_USER%@%VPS_IP%:%REMOTE_PATH%/

echo [2/4] Finding installer...
set INSTALLER_NAME=Visibility Browser_v%VERSION%_Installer.exe
if exist "%LOCAL_DIR%\%INSTALLER_NAME%" (
    echo Found: %INSTALLER_NAME%
    echo [3/4] Uploading installer...
    scp ^"%LOCAL_DIR%\%INSTALLER_NAME%^" %VPS_USER%@%VPS_IP%:%REMOTE_PATH%/

    set BLOCKMAP_NAME=%INSTALLER_NAME%.blockmap
    if exist "%LOCAL_DIR%\%BLOCKMAP_NAME%" (
        echo [4/4] Uploading blockmap...
        scp ^"%LOCAL_DIR%\%BLOCKMAP_NAME%^" %VPS_USER%@%VPS_IP%:%REMOTE_PATH%/
    )
) else (
    echo ERROR: Installer not found!
    echo Expected: %INSTALLER_NAME%
    echo Files in dist:
    dir "%LOCAL_DIR%\*.exe" /b
    exit /b 1
)

echo ========================================
echo Done! Update v%VERSION% uploaded.
echo Check: https://api.gomp.su/latest.yml
echo ========================================

pause
