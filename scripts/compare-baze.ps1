$ErrorActionPreference = 'Stop'

$key = Read-Host 'New Baze API key (input hidden)' -AsSecureString
$previousKey = [Environment]::GetEnvironmentVariable('BAZE_API_KEY', 'Process')
$result = 1
try {
    $env:BAZE_API_KEY = [System.Net.NetworkCredential]::new('', $key).Password
    node (Join-Path $PSScriptRoot 'compare-baze.js')
    $result = $LASTEXITCODE
} finally {
    [Environment]::SetEnvironmentVariable('BAZE_API_KEY', $previousKey, 'Process')
    $key.Dispose()
}
exit $result
