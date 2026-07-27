param(
    [Parameter(Mandatory = $true)]
    [string]$TemplatePath,

    [Parameter(Mandatory = $true)]
    [string]$OutputPath,

    [Parameter(Mandatory = $true)]
    [string]$JsonPath
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
$workbook = $null

function Set-TemplateCell {
    param(
        [string]$Address,
        [object]$Value
    )
    if ($null -eq $Value -or [string]::IsNullOrWhiteSpace([string]$Value)) {
        return
    }
    $cell = $script:sheet.Range($Address)
    $cell.NumberFormat = "@"
    $cell.Value2 = [string]$Value
    $cell.Font.Name = "Times New Roman"
    $cell.Font.Size = 10
}

try {
    $workbook = $excel.Workbooks.Open($OutputPath, 0, $false)
    $script:sheet = $workbook.Worksheets.Item($sheetName)

    Set-TemplateCell "A4" $data.contract_place
    Set-TemplateCell "J4" $data.contract_date

    Set-TemplateCell "B9" $data.seller_full_name
    Set-TemplateCell "D10" $data.seller_passport
    Set-TemplateCell "H10" $data.seller_passport_issue_date
    Set-TemplateCell "J10" $data.seller_phone
    Set-TemplateCell "D11" $data.seller_passport_issued_by
    Set-TemplateCell "D12" $data.seller_address

    Set-TemplateCell "B15" $data.buyer_full_name
    Set-TemplateCell "D16" $data.buyer_passport
    if (-not [string]::IsNullOrWhiteSpace([string]$data.buyer_phone)) {
        $script:sheet.Range("H16:J16").UnMerge()
        $script:sheet.Range("H10:J10").Copy()
        $script:sheet.Range("H16:J16").PasteSpecial(-4122)
        Set-TemplateCell "I16" (U "0442 0435 043B 002E 003A")
        Set-TemplateCell "J16" $data.buyer_phone
    }
    Set-TemplateCell "H16" $data.buyer_passport_issue_date
    Set-TemplateCell "D17" $data.buyer_passport_issued_by
    Set-TemplateCell "D18" $data.buyer_address

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
    $script:sheet.Range("A47").ClearContents()

    $workbook.Save()
}
finally {
    if ($workbook) {
        $workbook.Close($false)
    }
    $excel.Quit()
    $script:sheet = $null
}

Write-Output "OK"
