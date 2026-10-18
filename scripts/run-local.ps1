$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Maven = Join-Path $Root '.tools\apache-maven-3.10.0\bin\mvn.cmd'
if (-not (Test-Path $Maven)) { $Maven = 'mvn' }

# Cada processo recebe sua própria janela para facilitar a leitura didática dos logs.
Start-Process powershell -WindowStyle Hidden -ArgumentList '-NoExit','-Command',"Set-Location '$Root\backend\auth-service'; .\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8001"
Start-Process powershell -WindowStyle Hidden -ArgumentList '-NoExit','-Command',"Set-Location '$Root\backend\medication-service'; .\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8002"
Start-Process powershell -WindowStyle Hidden -ArgumentList '-NoExit','-Command',"Set-Location '$Root\backend\patient-service'; & '$Maven' spring-boot:run"
Start-Process powershell -WindowStyle Hidden -ArgumentList '-NoExit','-Command',"Set-Location '$Root\backend\sync-service'; & '$Maven' spring-boot:run"
Start-Process powershell -WindowStyle Hidden -ArgumentList '-NoExit','-Command',"Set-Location '$Root\backend\medical-record-service'; npm run dev"
Start-Process powershell -WindowStyle Hidden -ArgumentList '-NoExit','-Command',"Set-Location '$Root\backend\document-service'; npm run dev"
Start-Process powershell -WindowStyle Hidden -ArgumentList '-NoExit','-Command',"Set-Location '$Root\frontend\admin-portal'; npm run dev"
Start-Process powershell -WindowStyle Hidden -ArgumentList '-NoExit','-Command',"Set-Location '$Root\frontend\field-client'; npm run dev -- --port 5174"

Write-Host 'Processos iniciados em segundo plano. Consulte os logs de cada processo se algum health check falhar.'
