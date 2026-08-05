param(
    [Parameter(Mandatory = $true)]
    [string]$TemplatePath,

    [Parameter(Mandatory = $true)]
    [string]$OutputPath,

    [Parameter(Mandatory = $true)]
    [string]$JsonPath,

    [string]$PdfPath = "",
    [string]$JpgPath = ""
)

$ErrorActionPreference = "Stop"
$data = Get-Content -LiteralPath $JsonPath -Raw -Encoding UTF8 | ConvertFrom-Json
Copy-Item -LiteralPath $TemplatePath -Destination $OutputPath -Force

function U {
    param([string]$Hex)
    return -join ($Hex.Split(" ") | ForEach-Object { [char][Convert]::ToInt32($_, 16) })
}

$sheetName = U "041F 0443 0441 0442"
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$excel.AskToUpdateLinks = $false
$excel.EnableEvents = $false
$excel.ScreenUpdating = $false
$workbook = $null
$sheet = $null

function Set-TemplateCell {
    param(
        [string]$Address,
        [object]$Value
    )
    if ($null -eq $Value -or [string]::IsNullOrWhiteSpace([string]$Value)) {
        return
    }
    try {
        $sheet.Range($Address).Value2 = [string]$Value
    }
    catch {
        throw "$Address`: $($_.Exception.Message)"
    }
}

try {
    $workbook = $excel.Workbooks.Open($OutputPath, 0, $false)
    $sheet = $workbook.Worksheets.Item($sheetName)

    Set-TemplateCell "A4" $data.contract_place
    Set-TemplateCell "J4" $data.contract_date

    Set-TemplateCell "B9" $data.seller_full_name
    Set-TemplateCell "D10" $data.seller_passport
    Set-TemplateCell "H10" $data.seller_passport_issue_date
    Set-TemplateCell "D11" $data.seller_passport_issued_by
    Set-TemplateCell "D12" $data.seller_address
    Set-TemplateCell "J10" $data.seller_phone

    Set-TemplateCell "B15" $data.buyer_full_name
    Set-TemplateCell "D16" $data.buyer_passport
    Set-TemplateCell "H16" $data.buyer_passport_issue_date
    Set-TemplateCell "D17" $data.buyer_passport_issued_by
    Set-TemplateCell "D18" $data.buyer_address
    Set-TemplateCell "J16" $data.buyer_phone

    Set-TemplateCell "D22" $data.vehicle_make_model
    Set-TemplateCell "D23" $data.vehicle_type
    Set-TemplateCell "D24" $data.vehicle_year
    Set-TemplateCell "D25" $data.vin
    Set-TemplateCell "D26" $data.body_number
    Set-TemplateCell "D27" $data.chassis_number
    Set-TemplateCell "D28" $data.color
    Set-TemplateCell "D29" $data.pts_series_number
    Set-TemplateCell "D30" $data.sts_series_number
    Set-TemplateCell "D31" $data.registration_plate
    Set-TemplateCell "D34" $data.price

    Set-TemplateCell "G43" $data.seller_full_name
    Set-TemplateCell "G46" $data.buyer_full_name

    $sheet.PageSetup.PrintArea = "`$A`$1:`$J`$47"
    $sheet.PageSetup.Zoom = $false
    $sheet.PageSetup.FitToPagesWide = 1
    $sheet.PageSetup.FitToPagesTall = 1
    $sheet.PageSetup.PaperSize = 9
    $sheet.PageSetup.Orientation = 1
    $workbook.Save()
    if (-not [string]::IsNullOrWhiteSpace($PdfPath)) {
        $workbook.ExportAsFixedFormat(0, $PdfPath, 0, $true, $false)
    }
}
finally {
    if ($workbook) {
        $workbook.Close($false)
    }
    $excel.Quit()
    if ($sheet) {
        [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($sheet)
    }
    if ($workbook) {
        [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($workbook)
    }
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel)
}

Write-Output "OK"
