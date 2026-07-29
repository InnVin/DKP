param(
    [string]$BuildRoot = "D:\ADK",
    [switch]$SkipSync,
    [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"
$SourceRoot = Split-Path -Parent $PSScriptRoot
$BuildProject = Join-Path $BuildRoot "app"
$SdkRoot = Join-Path $BuildRoot "sdk"
$JdkRoot = Join-Path $BuildRoot "jdk"
$OutputRoot = Join-Path $SourceRoot "output"

if ($BuildRoot.ToCharArray() | Where-Object { [int]$_ -gt 127 }) {
    throw "BuildRoot must contain ASCII characters only. Example: D:\ADK"
}

$JdkHome = Get-ChildItem -LiteralPath $JdkRoot -Directory -ErrorAction SilentlyContinue |
    Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName "bin\java.exe") } |
    Select-Object -First 1

if (-not $JdkHome) {
    throw "OpenJDK 17 was not found in $JdkRoot."
}
if (-not (Test-Path -LiteralPath (Join-Path $SdkRoot "platforms\android-36\android.jar"))) {
    throw "Android SDK 36 was not found in $SdkRoot."
}
if (-not (Test-Path -LiteralPath (Join-Path $SdkRoot "ndk\27.1.12297006\source.properties"))) {
    throw "Android NDK 27.1.12297006 was not found in $SdkRoot."
}

$SourceLock = Join-Path $SourceRoot "package-lock.json"
$BuildLock = Join-Path $BuildProject "package-lock.json"
$NeedsInstall = -not (Test-Path -LiteralPath (Join-Path $BuildProject "node_modules"))
if (-not $NeedsInstall -and (Test-Path -LiteralPath $SourceLock) -and (Test-Path -LiteralPath $BuildLock)) {
    $NeedsInstall = (Get-FileHash -LiteralPath $SourceLock -Algorithm SHA256).Hash -ne
        (Get-FileHash -LiteralPath $BuildLock -Algorithm SHA256).Hash
}

New-Item -ItemType Directory -Force -Path $BuildProject, $OutputRoot | Out-Null

if (-not $SkipSync) {
    Write-Host "Synchronizing project into the short ASCII build path..."
    & robocopy.exe `
        $SourceRoot `
        $BuildProject `
        /E `
        /R:2 `
        /W:1 `
        /XD node_modules android output .expo .local-toolchain dist-check `
        /NFL `
        /NDL `
        /NJH `
        /NJS `
        /NP
    if ($LASTEXITCODE -ge 8) {
        throw "Project synchronization failed with robocopy code $LASTEXITCODE."
    }
}

if ($NeedsInstall -and -not $SkipInstall) {
    Write-Host "Installing JavaScript dependencies..."
    Push-Location $BuildProject
    try {
        & npm.cmd ci
        if ($LASTEXITCODE -ne 0) {
            throw "npm ci failed."
        }
    }
    finally {
        Pop-Location
    }
}

if (-not (Test-Path -LiteralPath (Join-Path $BuildProject "node_modules"))) {
    throw "node_modules is missing in $BuildProject. Run without -SkipInstall."
}

$env:JAVA_HOME = $JdkHome.FullName
$env:ANDROID_HOME = $SdkRoot
$env:ANDROID_SDK_ROOT = $SdkRoot
$env:NODE_ENV = "production"
$env:Path = "$($JdkHome.FullName)\bin;$SdkRoot\platform-tools;$env:Path"

Push-Location $BuildProject
try {
    Write-Host "Generating the Android project..."
    & npx.cmd expo prebuild --platform android --no-install --clean
    if ($LASTEXITCODE -ne 0) {
        throw "Expo prebuild failed."
    }

    Write-Host "Building the arm64 release APK..."
    Push-Location (Join-Path $BuildProject "android")
    try {
        & ".\gradlew.bat" `
            assembleRelease `
            "-PreactNativeArchitectures=arm64-v8a" `
            --no-daemon `
            --stacktrace
        if ($LASTEXITCODE -ne 0) {
            throw "Gradle build failed."
        }
    }
    finally {
        Pop-Location
    }
}
finally {
    Pop-Location
}

$BuiltApk = Join-Path $BuildProject "android\app\build\outputs\apk\release\app-release.apk"
if (-not (Test-Path -LiteralPath $BuiltApk)) {
    throw "Gradle finished without producing app-release.apk."
}

$FinalApk = Join-Path $OutputRoot "AutoDogovor-1.0.0.apk"
Copy-Item -LiteralPath $BuiltApk -Destination $FinalApk -Force
$Hash = (Get-FileHash -LiteralPath $FinalApk -Algorithm SHA256).Hash
Write-Host "APK: $FinalApk"
Write-Host "SHA256: $Hash"
