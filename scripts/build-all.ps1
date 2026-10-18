$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Maven = Join-Path $Root '.tools\apache-maven-3.10.0\bin\mvn.cmd'
if (-not (Test-Path $Maven)) { $Maven = 'mvn' }
$Npm = 'npm.cmd'
$MavenRepo = Join-Path $Root '.m2\repository'

function Invoke-Checked {
    param(
        [Parameter(Mandatory)] [string] $Executable,
        [string[]] $CommandArgs = @()
    )
    & $Executable @CommandArgs
    if ($LASTEXITCODE -ne 0) {
        throw "Comando '$Executable' falhou com código $LASTEXITCODE."
    }
}

Push-Location (Join-Path $Root 'backend\patient-service'); try { Invoke-Checked -Executable $Maven -CommandArgs @("-Dmaven.repo.local=$MavenRepo", 'clean', 'package') } finally { Pop-Location }
Push-Location (Join-Path $Root 'backend\sync-service'); try { Invoke-Checked -Executable $Maven -CommandArgs @("-Dmaven.repo.local=$MavenRepo", 'clean', 'package') } finally { Pop-Location }
Push-Location (Join-Path $Root 'frontend\admin-portal'); try { Invoke-Checked -Executable $Npm -CommandArgs @('run', 'build') } finally { Pop-Location }
Push-Location (Join-Path $Root 'frontend\field-client'); try { Invoke-Checked -Executable $Npm -CommandArgs @('run', 'build') } finally { Pop-Location }

Write-Host 'JARs e frontends de produção gerados.' -ForegroundColor Green
