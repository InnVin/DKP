$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$BundledPython = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"
$env:PIP_PROGRESS_BAR = "off"

if (-not (Test-Path -LiteralPath $BundledPython)) {
    $Python312 = Get-Command py -ErrorAction SilentlyContinue
    if ($Python312) {
        $BundledPython = "py -3.12"
    } else {
        $SystemPython = Get-Command python -ErrorAction SilentlyContinue
        if ($SystemPython) {
            $BundledPython = $SystemPython.Source
        } else {
            throw "Python не найден. Установите Python 3.12 или запустите установку из Codex."
        }
    }
}

if (Test-Path -LiteralPath "$ProjectRoot\.venv\pyvenv.cfg") {
    $Config = Get-Content -LiteralPath "$ProjectRoot\.venv\pyvenv.cfg" -Raw
    if ($Config -match "Python314|Python312\\python.exe.*Users\\1234") {
        Remove-Item -LiteralPath "$ProjectRoot\.venv" -Recurse -Force
    }
}

if (-not (Test-Path -LiteralPath "$ProjectRoot\.venv\Scripts\python.exe")) {
    if ($BundledPython -eq "py -3.12") {
        py -3.12 -m venv "$ProjectRoot\.venv"
    } else {
        & $BundledPython -m venv "$ProjectRoot\.venv"
    }
}

& "$ProjectRoot\.venv\Scripts\python.exe" -m pip install --upgrade pip --progress-bar off
& "$ProjectRoot\.venv\Scripts\python.exe" -m pip install -r "$ProjectRoot\requirements.txt" --progress-bar off

Write-Host ""
Write-Host "Установка завершена. Запускайте run.ps1" -ForegroundColor Green
