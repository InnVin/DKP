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

function Set-FieldValue {
    param(
        [object]$Recordset,
        [int]$Index,
        [object]$Value
    )
    if ($null -eq $Value -or [string]::IsNullOrWhiteSpace([string]$Value)) {
        $Recordset.Fields.Item($Index).Value = [DBNull]::Value
    }
    else {
        $Recordset.Fields.Item($Index).Value = [string]$Value
    }
}

$baseSheet = U "0411 0430 0437 0430"
$contractSheet = U "0414 041A 041F"
$connectionString = "Provider=Microsoft.ACE.OLEDB.12.0;Data Source=$OutputPath;Extended Properties='Excel 8.0;HDR=No;IMEX=0'"
$connection = New-Object -ComObject ADODB.Connection
$connection.Open($connectionString)

try {
    $recordset = New-Object -ComObject ADODB.Recordset
    $recordset.Open("SELECT * FROM [$baseSheet`$]", $connection, 2, 3)
    $recordId = $null

    try {
        if (-not $recordset.EOF) {
            $recordset.MoveFirst()
        }
        while (-not $recordset.EOF) {
            $id = $recordset.Fields.Item(0).Value
            $seller = $recordset.Fields.Item(1).Value
            if ($null -ne $id -and [string]$id -ne "ID" -and [string]::IsNullOrWhiteSpace([string]$seller)) {
                $recordId = [int]$id
                break
            }
            $recordset.MoveNext()
        }

        if ($null -eq $recordId) {
            throw "No empty row found in the Base sheet."
        }

        $values = @(
            $data.seller_full_name, $data.seller_passport,
            $data.seller_passport_issued_by, $data.seller_passport_issue_date,
            $data.seller_address, $data.buyer_full_name, $data.buyer_passport,
            $data.buyer_passport_issued_by, $data.buyer_passport_issue_date,
            $data.buyer_address, $data.vehicle_make_model, $data.vehicle_type,
            $data.vehicle_year, $data.vin, $data.body_number, $data.chassis_number,
            $data.color, $data.pts_series_number, $data.sts_series_number,
            $data.registration_plate, $data.price, $data.contract_date,
            $data.contract_date
        )

        for ($index = 0; $index -lt $values.Count; $index++) {
            Set-FieldValue -Recordset $recordset -Index ($index + 1) -Value $values[$index]
        }
        $recordset.Update()
    }
    finally {
        if ($recordset.State -ne 0) {
            $recordset.Close()
        }
    }

    $selector = New-Object -ComObject ADODB.Recordset
    $selector.Open("SELECT * FROM [$contractSheet`$L1:L2]", $connection, 2, 3)
    try {
        if ($selector.EOF) {
            throw "Contract selector cell was not found."
        }
        $selector.Fields.Item(0).Value = $recordId
        $selector.Update()
    }
    finally {
        if ($selector.State -ne 0) {
            $selector.Close()
        }
    }
}
finally {
    $connection.Close()
}

Write-Output $recordId
