$ErrorActionPreference = "Stop"

$Ollama = Get-Command ollama -ErrorAction SilentlyContinue
if (-not $Ollama) {
    Write-Host "Installing Ollama..." -ForegroundColor Cyan
    irm https://ollama.com/install.ps1 | iex
    $Ollama = Get-Command ollama -ErrorAction SilentlyContinue
}

if (-not $Ollama) {
    throw "Ollama was not installed. Check internet and DNS, then try again."
}

Write-Host "Downloading qwen2.5vl:3b (about 3.2 GB)..." -ForegroundColor Cyan
& $Ollama.Source pull qwen2.5vl:3b

Write-Host ""
Write-Host "Local AI is installed." -ForegroundColor Green
