@echo off
chcp 65001 >nul
REM Запуск экспорта Excel для SATU на вашем ПК (Windows).
REM 1. Установите Python 3 и зависимости: pip install -r requirements.txt
REM 2. Создайте в этой папке .env с API_KEY и SITEMAP_BASE_URL=https://grgroup.kz
REM 3. Запустите run_satu_export.bat

cd /d "%~dp0"

if exist "venv\Scripts\activate.bat" (
    call venv\Scripts\activate.bat
)

set OUTPUT=%1
if "%OUTPUT%"=="" set OUTPUT=satu_import_full.xlsx
if not "%OUTPUT:~1,1%"==":" set OUTPUT=%CD%\%OUTPUT%

echo Экспорт Excel для SATU (данные из B2B API + portal_export)...
python export_satu_excel.py --image-via-api -o "%OUTPUT%"
if errorlevel 1 (
    echo Ошибка. Проверьте: Python установлен, pip install -r requirements.txt, в .env заданы API_KEY и SITEMAP_BASE_URL.
    pause
    exit /b 1
)

echo.
echo Файл сохранён: %OUTPUT%
pause
