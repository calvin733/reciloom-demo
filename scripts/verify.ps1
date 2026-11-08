$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot

function Invoke-ProjectCheck {
    param([string]$Folder, [string]$Script)
    Push-Location (Join-Path $projectRoot $Folder)
    try {
        Write-Host "Memeriksa $Folder / $Script"
        & npm.cmd run $Script
        if ($LASTEXITCODE -ne 0) { throw "Pemeriksaan $Folder / $Script gagal." }
    } finally { Pop-Location }
}

# Tidak menjalankan seed, migration, atau skrip test backend yang membuat data.
Invoke-ProjectCheck -Folder 'backend' -Script 'typecheck'
Invoke-ProjectCheck -Folder 'backend' -Script 'typecheck:tests'
Invoke-ProjectCheck -Folder 'backend' -Script 'test'
Invoke-ProjectCheck -Folder 'backend' -Script 'build'
Invoke-ProjectCheck -Folder 'frontend' -Script 'test'
Invoke-ProjectCheck -Folder 'frontend' -Script 'build'
Write-Host 'Seluruh pemeriksaan ReciLoom berhasil.' -ForegroundColor Green
