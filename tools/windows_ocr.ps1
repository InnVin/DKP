param(
    [Parameter(Mandatory = $true)]
    [string]$Path
)

$ErrorActionPreference = "Stop"
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

Add-Type -AssemblyName System.Runtime.WindowsRuntime
[Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.FileAccessMode, Windows.Storage, ContentType = WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType = WindowsRuntime] | Out-Null
[Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime] | Out-Null
[Windows.Globalization.Language, Windows.Globalization, ContentType = WindowsRuntime] | Out-Null
[Windows.Data.Pdf.PdfDocument, Windows.Data.Pdf, ContentType = WindowsRuntime] | Out-Null
[Windows.Data.Pdf.PdfPageRenderOptions, Windows.Data.Pdf, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.Streams.InMemoryRandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime] | Out-Null

$asTaskMethods = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq "AsTask" }
$asTaskOperation = $asTaskMethods | Where-Object {
    $_.IsGenericMethod -and $_.GetParameters().Count -eq 1
} | Select-Object -First 1
$asTaskAction = $asTaskMethods | Where-Object {
    -not $_.IsGenericMethod -and $_.GetParameters().Count -eq 1
} | Select-Object -First 1

function Await-Operation {
    param(
        [object]$Operation,
        [Type]$ResultType
    )
    $method = $asTaskOperation.MakeGenericMethod($ResultType)
    $task = $method.Invoke($null, @($Operation))
    $task.Wait()
    return $task.Result
}

function Await-Action {
    param([object]$Action)
    $task = $asTaskAction.Invoke($null, @($Action))
    $task.Wait()
}

function Recognize-Stream {
    param(
        [object]$Stream,
        [object]$Engine
    )
    $decoder = Await-Operation ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($Stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $bitmap = Await-Operation ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
    $result = Await-Operation ($Engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
    return [string]$result.Text
}

$language = [Windows.Globalization.Language]::new("ru")
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($language)
if ($null -eq $engine) {
    throw "Russian Windows OCR is unavailable."
}

$file = Await-Operation ([Windows.Storage.StorageFile]::GetFileFromPathAsync((Resolve-Path -LiteralPath $Path).Path)) ([Windows.Storage.StorageFile])
$extension = [System.IO.Path]::GetExtension($Path).ToLowerInvariant()
$pages = @()

if ($extension -eq ".pdf") {
    $pdf = Await-Operation ([Windows.Data.Pdf.PdfDocument]::LoadFromFileAsync($file)) ([Windows.Data.Pdf.PdfDocument])
    for ($index = 0; $index -lt $pdf.PageCount; $index++) {
        $page = $pdf.GetPage($index)
        $stream = [Windows.Storage.Streams.InMemoryRandomAccessStream]::new()
        try {
            $options = [Windows.Data.Pdf.PdfPageRenderOptions]::new()
            $options.DestinationWidth = 2400
            Await-Action ($page.RenderToStreamAsync($stream, $options))
            $stream.Seek(0)
            $pages += [ordered]@{
                page = $index + 1
                text = (Recognize-Stream -Stream $stream -Engine $engine)
            }
        }
        finally {
            $stream.Dispose()
            $page.Dispose()
        }
    }
}
else {
    $stream = Await-Operation ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
    try {
        $pages += [ordered]@{
            page = 1
            text = (Recognize-Stream -Stream $stream -Engine $engine)
        }
    }
    finally {
        $stream.Dispose()
    }
}

[ordered]@{
    engine = "windows-ocr"
    pages = $pages
} | ConvertTo-Json -Depth 5 -Compress
