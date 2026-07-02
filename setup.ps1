$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$BundledPython = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"

if (-not (Test-Path -LiteralPath $BundledPython)) {
    $SystemPython = Get-Command python -ErrorAction SilentlyContinue
    if ($SystemPython) {
        $BundledPython = $SystemPython.Source
    } else {
        throw "Python не найден. Установите Python 3.12 или запустите установку из Codex."
    }
}

if (-not (Test-Path -LiteralPath "$ProjectRoot\.venv\Scripts\python.exe")) {
    & $BundledPython -m venv "$ProjectRoot\.venv"
}

& "$ProjectRoot\.venv\Scripts\python.exe" -m pip install --upgrade pip
& "$ProjectRoot\.venv\Scripts\python.exe" -m pip install -r "$ProjectRoot\requirements.txt"

Write-Host ""
Write-Host "Установка завершена. Запускайте run.ps1" -ForegroundColor Green
