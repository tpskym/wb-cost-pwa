param([string]$Uri, [switch]$ValidateOnly)
$ErrorActionPreference = 'Stop'

function Resolve-WorkshopFile([string]$Request, [string]$Folder) {
    # Never accept paths, commands, parameters, or arbitrary file extensions from a website.
    if ($Request -cnotmatch '^workshop-files://open/(label\.pdf|model\.(3mf|stl|step|stp|obj|gcode))/?$') {
        throw 'Unsupported file link.'
    }
    $name = $Matches[1]
    if (-not [IO.Path]::IsPathRooted($Folder) -or -not (Test-Path -LiteralPath $Folder -PathType Container)) {
        throw 'Working folder not found. Run Install.cmd again and select your working folder.'
    }
    $file = Get-Item -LiteralPath (Join-Path $Folder $name) -ErrorAction Stop
    if ($file.PSIsContainer -or ($file.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        throw 'Only regular saved files can be opened.'
    }
    return $file.FullName
}

if ($ValidateOnly) { return }
try {
    $config = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'settings.json') -Raw | ConvertFrom-Json
    $path = Resolve-WorkshopFile $Uri $config.folder
    # ShellExecute uses the user's Windows default application (Bambu Studio / Foxit).
    $start = New-Object System.Diagnostics.ProcessStartInfo
    $start.FileName = $path
    $start.UseShellExecute = $true
    [System.Diagnostics.Process]::Start($start) | Out-Null
} catch {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show(
        "Cannot open the saved file.`r`n$($_.Exception.Message)`r`nCheck that the same working folder is selected in Workshop and in Install.cmd, and assign a Windows default application.",
        'Workshop files', 'OK', 'Error') | Out-Null
    exit 1
}
