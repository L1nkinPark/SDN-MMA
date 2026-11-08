param(
  [string]$Database = 'studyspot',
  [string]$HostName = '127.0.0.1',
  [int]$Port = 27017
)

$ErrorActionPreference = 'Stop'
if ($Database -notmatch '^[A-Za-z0-9_-]+$') { throw 'Invalid database name.' }
if (-not (Get-Command mongodump -ErrorAction SilentlyContinue)) {
  throw 'Install MongoDB Database Tools and add mongodump to PATH.'
}
$backupRoot = Join-Path $PSScriptRoot '..\backups'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$target = Join-Path $backupRoot $stamp
New-Item -ItemType Directory -Path $target -Force | Out-Null
& mongodump --host $HostName --port $Port --db $Database --out $target
if ($LASTEXITCODE -ne 0) { throw "mongodump failed with exit code $LASTEXITCODE" }
Write-Output "Backup saved: $target"
