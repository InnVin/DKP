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
$connectionString = "Provider=Microsoft.ACE.OLEDB.12.0;Data Source=$OutputPath;Extended Properties='Excel 8.0;HDR=No;IMEX=0'"
$connection = New-Object -ComObject ADODB.Connection
$connection.Open($connectionString)
$recordset = New-Object -ComObject ADODB.Recordset
$recordset.Open("SELECT * FROM [$sheetName`$]", $connection, 2, 3)

function Set-TemplateCell {
    param(
        [int]$Row,
        [int]$Column,
        [object]$Value
    )
    if ($null -eq $Value -or [string]::IsNullOrWhiteSpace([string]$Value)) {
        return
    }
    if ($Row -le 1) {
        return
    }
    $recordset.MoveFirst()
    if ($Row -gt 2) {
        $recordset.Move($Row - 2)
    }
    $recordset.Fields.Item($Column - 1).Value = [string]$Value
    $recordset.Update()
}

try {
    Set-TemplateCell 5 1 $data.contract_place
    Set-TemplateCell 5 10 $data.contract_date

    Set-TemplateCell 9 2 $data.seller_full_name
    Set-TemplateCell 10 2 $data.seller_passport
    Set-TemplateCell 10 8 $data.seller_passport_issue_date
    Set-TemplateCell 10 10 $data.seller_phone
    Set-TemplateCell 11 2 $data.seller_passport_issued_by
    Set-TemplateCell 12 2 $data.seller_address

    Set-TemplateCell 15 2 $data.buyer_full_name
    Set-TemplateCell 16 2 $data.buyer_passport
    Set-TemplateCell 16 8 $data.buyer_passport_issue_date
    Set-TemplateCell 16 10 $data.buyer_phone
    Set-TemplateCell 17 2 $data.buyer_passport_issued_by
    Set-TemplateCell 18 2 $data.buyer_address

    Set-TemplateCell 22 4 $data.vehicle_make_model
    Set-TemplateCell 23 4 $data.vehicle_type
    Set-TemplateCell 24 4 $data.vehicle_year
    Set-TemplateCell 25 4 $data.vin
    Set-TemplateCell 26 4 $data.body_number
    Set-TemplateCell 27 4 $data.chassis_number
    Set-TemplateCell 28 4 $data.color
    Set-TemplateCell 29 4 $data.pts_series_number
    Set-TemplateCell 30 4 $data.sts_series_number
    Set-TemplateCell 31 4 $data.registration_plate
    Set-TemplateCell 34 6 $data.price
}
finally {
    if ($recordset.State -ne 0) {
        $recordset.Close()
    }
    $connection.Close()
}

Write-Output "OK"
