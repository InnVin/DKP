param(
    [Parameter(Mandatory = $true)]
    [string]$Path
)

$ErrorActionPreference = "Stop"
$providers = @("Microsoft.ACE.OLEDB.12.0", "Microsoft.Jet.OLEDB.4.0")

foreach ($provider in $providers) {
    try {
        $connectionString = "Provider=$provider;Data Source=$Path;Extended Properties='Excel 8.0;HDR=No;IMEX=1;ReadOnly=True'"
        $connection = New-Object System.Data.OleDb.OleDbConnection($connectionString)
        $connection.Open()
        Write-Output "PROVIDER=$provider"
        $schema = $connection.GetOleDbSchemaTable([System.Data.OleDb.OleDbSchemaGuid]::Tables, $null)
        foreach ($row in $schema.Rows) {
            $tableName = [string]$row.TABLE_NAME
            if ($tableName.EndsWith('$') -or $tableName.EndsWith('$''')) {
                Write-Output "SHEET=$tableName"
                $safeTable = $tableName.Replace("'", "''")
                $command = $connection.CreateCommand()
                $command.CommandText = "SELECT TOP 120 * FROM [$safeTable]"
                $adapter = New-Object System.Data.OleDb.OleDbDataAdapter($command)
                $data = New-Object System.Data.DataTable
                [void]$adapter.Fill($data)
                Write-Output ("COLUMNS=" + (($data.Columns | ForEach-Object { $_.ColumnName }) -join "|"))
                for ($index = 0; $index -lt $data.Rows.Count; $index++) {
                    $parts = @()
                    for ($column = 0; $column -lt $data.Columns.Count; $column++) {
                        $value = [string]$data.Rows[$index][$column]
                        if (-not [string]::IsNullOrWhiteSpace($value)) {
                            $parts += ("C{0}={1}" -f ($column + 1), $value.Replace("`r", " ").Replace("`n", " "))
                        }
                    }
                    if ($parts.Count -gt 0) {
                        Write-Output ("R{0}|{1}" -f ($index + 1), ($parts -join "|"))
                    }
                }
            }
        }
        $connection.Close()
        exit 0
    }
    catch {
        Write-Output "$provider`: $($_.Exception.Message)"
    }
}

exit 1
