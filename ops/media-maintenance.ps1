param([switch]$ApprovedCloudMaintenance)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $taskRoot
$taskNode = Join-Path $taskRoot '.tools\node-v22.23.4-win-x64\node.exe'
if (!(Test-Path -LiteralPath $taskNode)) { $taskNode = (Get-Command node -ErrorAction Stop).Source }
$taskLogs = Join-Path $taskRoot '.tools\maintenance-logs'
New-Item -ItemType Directory -Force -Path $taskLogs | Out-Null
$taskLock = $null
try {
  $taskLock = [System.IO.File]::Open((Join-Path $taskLogs 'maintenance.lock'), 'OpenOrCreate', 'ReadWrite', 'None')
  $taskLog = Join-Path $taskLogs ((Get-Date -Format 'yyyyMMdd-HHmmss') + '.log')
  $taskArgs = @('--import','tsx','scripts/video-maintenance.ts','--all-media')
  if ($ApprovedCloudMaintenance) { $taskArgs += @('--apply','--approved-cloud-maintenance') }
  & $taskNode @taskArgs *> $taskLog
  $taskExit = $LASTEXITCODE
  if ($taskExit -ne 0) { throw "Media maintenance failed (exit $taskExit). Inspect $taskLog" }
  Write-Output "Media maintenance completed. Review $taskLog"
} finally { if ($null -ne $taskLock) { $taskLock.Dispose() } }
