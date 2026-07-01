$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$Python = "$ProjectRoot\.venv\Scripts\python.exe"
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
& $Python -m uvicorn app.main:app --host 127.0.0.1 --port $Port
