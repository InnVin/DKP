$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$Python = "$ProjectRoot\.venv\Scripts\python.exe"
$SystemPython = "C:\Python314\python.exe"
$Port = 8765

if (-not (Test-Path -LiteralPath $Python)) {
    Write-Host "Сначала выполняется первоначальная установка..." -ForegroundColor Yellow
    & "$ProjectRoot\setup.ps1"
}

$Existing = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique
foreach ($ProcessId in $Existing) {
    try {
        Write-Host "Останавливаю старый сервер на порту $Port..." -ForegroundColor Yellow
        Stop-Process -Id $ProcessId -Force
    } catch {
        Write-Host "Не удалось остановить процесс ${ProcessId}: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Start-Process "http://127.0.0.1:$Port"
Write-Host "АвтоДоговор запущен: http://127.0.0.1:$Port" -ForegroundColor Green
Write-Host "Для остановки нажмите Ctrl+C или закройте это окно." -ForegroundColor DarkGray

try {
    & $Python -c "import fastapi, uvicorn" 2>$null
    if ($LASTEXITCODE -eq 0) {
        & $Python -m uvicorn app.main:app --host 127.0.0.1 --port $Port
        exit $LASTEXITCODE
    }
} catch {}

Write-Host "Основной запуск недоступен. Включаю аварийный режим." -ForegroundColor Yellow
if (Test-Path -LiteralPath $SystemPython) {
    & $SystemPython "$ProjectRoot\fallback_autodogovor_server.py"
} else {
    python "$ProjectRoot\fallback_autodogovor_server.py"
}
