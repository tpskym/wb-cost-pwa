$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
try {
    $destination = Join-Path $env:LOCALAPPDATA 'WorkshopFileOpener'
    $settingsPath = Join-Path $destination 'settings.json'
    $picker = New-Object System.Windows.Forms.FolderBrowserDialog
    $picker.Description = 'Select the SAME working folder used by Workshop for label.pdf and model.*'
    $picker.ShowNewFolderButton = $true
    if (Test-Path -LiteralPath $settingsPath) {
        $picker.SelectedPath = (Get-Content -LiteralPath $settingsPath -Raw | ConvertFrom-Json).folder
    } else { $picker.SelectedPath = Join-Path $env:USERPROFILE 'Downloads' }
    if ($picker.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { exit 0 }
    $folder = $picker.SelectedPath
    $picker.Dispose()
    New-Item -ItemType Directory -Path $destination -Force | Out-Null
    $runner = Join-Path $destination 'Open-WorkshopFile.ps1'
    $source = Join-Path $PSScriptRoot 'Open-WorkshopFile.ps1'
    if ([IO.Path]::GetFullPath($runner) -ne [IO.Path]::GetFullPath($source)) {
        Copy-Item -LiteralPath $source -Destination $runner -Force
    }
    @{ folder = $folder } | ConvertTo-Json | Set-Content -LiteralPath $settingsPath -Encoding UTF8
    $registry = 'HKCU:\Software\Classes\workshop-files'
    New-Item -Path $registry -Force | Out-Null
    Set-Item -Path $registry -Value 'URL:Workshop saved files'
    New-ItemProperty -Path $registry -Name 'URL Protocol' -Value '' -PropertyType String -Force | Out-Null
    New-Item -Path "$registry\shell\open\command" -Force | Out-Null
    $powershell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
    $command = '"' + $powershell + '" -NoProfile -STA -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $runner + '" "%1"'
    Set-Item -Path "$registry\shell\open\command" -Value $command
    [System.Windows.Forms.MessageBox]::Show(
        "Installed for this Windows user.`r`nWorking folder: $folder`r`nIn Workshop, enable 'Windows component installed'.`r`nSet .3mf/.stl files to Bambu Studio and .pdf to Foxit in Windows default apps.",
        'Workshop files', 'OK', 'Information') | Out-Null
} catch {
    [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'Installation failed', 'OK', 'Error') | Out-Null
    exit 1
}
