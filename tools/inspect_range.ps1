param([string]$Path)
$connectionString = "Provider=Microsoft.ACE.OLEDB.12.0;Data Source=$Path;Extended Properties='Excel 8.0;HDR=No;IMEX=0'"
$connection = New-Object System.Data.OleDb.OleDbConnection($connectionString)
$connection.Open()
try {
    $sheet = -join ("0411 0430 0437 0430".Split(" ") | ForEach-Object { [char][Convert]::ToInt32($_, 16) })
    foreach ($range in @("B15:X15", "L2:L2")) {
        $command = $connection.CreateCommand()
        $command.CommandText = "SELECT * FROM [$sheet`$$range]"
        $adapter = New-Object System.Data.OleDb.OleDbDataAdapter($command)
        $table = New-Object System.Data.DataTable
        [void]$adapter.Fill($table)
        Write-Output "$range=$($table.Columns.ColumnName -join '|')"
    }
}
finally {
    $connection.Close()
}
