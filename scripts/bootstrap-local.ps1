$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot

foreach ($Service in @('auth-service','medication-service')) {
  $Path = Join-Path $Root "backend\$Service"
  Push-Location $Path
  try {
    if (-not (Test-Path '.venv')) { python -m venv .venv }
    & .\.venv\Scripts\python.exe -m pip install -e '.[dev]'
  } finally { Pop-Location }
}
foreach ($Path in @('backend\medical-record-service','backend\document-service','frontend\admin-portal','frontend\field-client')) {
  Push-Location (Join-Path $Root $Path); try { npm ci } finally { Pop-Location }
}
Write-Host 'Dependências locais instaladas. Configure PostgreSQL e .env antes de iniciar.' -ForegroundColor Green
