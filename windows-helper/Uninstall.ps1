$ErrorActionPreference = 'Stop'
Remove-Item -LiteralPath 'HKCU:\Software\Classes\workshop-files' -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath (Join-Path $env:LOCALAPPDATA 'WorkshopFileOpener') -Recurse -Force -ErrorAction SilentlyContinue
Write-Host 'Workshop file opener removed. Your PDF and model files were not removed.'
