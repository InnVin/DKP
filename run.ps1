$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$Python = "$ProjectRoot\.venv\Scripts\python.exe"
$SystemPython = "C:\Python314\python.exe"
$Port = 8765

if (-not (Test-Path -LiteralPath $Python)) {
    Write-Host "First setup is running..." -ForegroundColor Yellow
    & "$ProjectRoot\setup.ps1"
}

$Existing = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique
foreach ($ProcessId in $Existing) {
    try {
        Write-Host "Stopping old server on port $Port..." -ForegroundColor Yellow
        Stop-Process -Id $ProcessId -Force
    } catch {
        Write-Host "Could not stop process ${ProcessId}: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Start-Process "http://127.0.0.1:$Port"
Write-Host "AutoDogovor started: http://127.0.0.1:$Port" -ForegroundColor Green
Write-Host "To stop: press Ctrl+C or close this window." -ForegroundColor DarkGray

try {
    & $Python -c "import fastapi, uvicorn" 2>$null
    if ($LASTEXITCODE -eq 0) {
        & $Python -m uvicorn app.main:app --host 127.0.0.1 --port $Port
        exit $LASTEXITCODE
    }
} catch {}

Write-Host "Main server is unavailable. Starting fallback mode." -ForegroundColor Yellow
if (Test-Path -LiteralPath $SystemPython) {
    & $SystemPython "$ProjectRoot\fallback_autodogovor_server.py"
} else {
    python "$ProjectRoot\fallback_autodogovor_server.py"
}
