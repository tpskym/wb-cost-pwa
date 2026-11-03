$ErrorActionPreference = 'Stop'
# Parse all scripts using the Windows PowerShell parser, including paths containing spaces.
Get-ChildItem -LiteralPath $PSScriptRoot -Filter '*.ps1' | ForEach-Object {
    $tokens = $null; $errors = $null
    [System.Management.Automation.Language.Parser]::ParseFile($_.FullName, [ref]$tokens, [ref]$errors) | Out-Null
    if ($errors.Count) { throw ($errors | Out-String) }
}
. (Join-Path $PSScriptRoot 'Open-WorkshopFile.ps1') -ValidateOnly
$folder = Join-Path ([IO.Path]::GetTempPath()) ('Workshop test ' + [Guid]::NewGuid())
New-Item -ItemType Directory -Path $folder | Out-Null
try {
    foreach ($name in @('label.pdf','model.3mf','model.stl','model.step','model.stp','model.obj','model.gcode')) {
        Set-Content -LiteralPath (Join-Path $folder $name) -Value 'test'
        $actual = Resolve-WorkshopFile "workshop-files://open/$name" $folder
        if ($actual -ne (Join-Path $folder $name)) { throw 'Wrong resolved file' }
    }
    foreach ($request in @('workshop-files://open/model.exe','workshop-files://open/../label.pdf','workshop-files://open/label.pdf?path=C:\other.pdf','workshop-files://open/%2e%2e%2fmodel.stl','workshop-files://open/model.stl#arg','workshop-files://open/model.stl"; calc','https://open/label.pdf')) {
        $rejected = $false
        try { Resolve-WorkshopFile $request $folder | Out-Null } catch { $rejected = $true }
        if (-not $rejected) { throw "Unsafe request accepted: $request" }
    }
    Remove-Item -LiteralPath (Join-Path $folder 'label.pdf')
    $rejected = $false
    try { Resolve-WorkshopFile 'workshop-files://open/label.pdf' $folder | Out-Null } catch { $rejected = $true }
    if (-not $rejected) { throw 'Missing file accepted' }
    Write-Host 'Windows component validation passed; no applications were launched.'
} finally { Remove-Item -LiteralPath $folder -Recurse -Force }
