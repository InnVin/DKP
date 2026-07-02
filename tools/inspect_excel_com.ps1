param(
    [Parameter(Mandatory = $true)]
    [string]$Path
)

$ErrorActionPreference = "Stop"
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$excel.AskToUpdateLinks = $false
$excel.EnableEvents = $false
$workbook = $null

try {
    $workbook = $excel.Workbooks.Open($Path, 0, $true)
    foreach ($sheet in $workbook.Worksheets) {
        Write-Output "SHEET=$($sheet.Name)|USED=$($sheet.UsedRange.Address())|PRINT=$($sheet.PageSetup.PrintArea)"
        $used = $sheet.UsedRange
        for ($row = 1; $row -le $used.Rows.Count; $row++) {
            $parts = @()
            for ($column = 1; $column -le $used.Columns.Count; $column++) {
                $cell = $used.Cells.Item($row, $column)
                $formula = [string]$cell.Formula
                if ($formula.StartsWith("=")) {
                    $parts += "$($cell.Address($false, $false))=$formula"
                }
            }
            if ($parts.Count -gt 0) {
                Write-Output ($parts -join "|")
            }
        }
    }
}
finally {
    if ($workbook) {
        $workbook.Close($false)
    }
    $excel.Quit()
}
