$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$serverRunning = Get-NetTCPConnection -LocalPort 4000 -State Listen -ErrorAction SilentlyContinue
if ($serverRunning) {
  Write-Host "Jekyll server already running at http://127.0.0.1:4000"
  return
}

& 'C:\Ruby33-x64\bin\jekyll.bat' serve --livereload --force_polling