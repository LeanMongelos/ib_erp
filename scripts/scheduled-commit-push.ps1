# Commit + push programado con verificacion de produccion post-deploy.
param(
  [string]$TargetTime = '12:15:00',
  [string]$Branch = 'master'
)

$repo = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$log = Join-Path $repo 'scheduled-commit-1215.log'
$verifyScript = Join-Path $repo 'scripts/verify-prod-health.ps1'

function Log($msg) {
  $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - $msg"
  $line | Tee-Object -FilePath $log -Append
}

$today = Get-Date -Format 'yyyy-MM-dd'
$target = [DateTime]::Parse("$today $TargetTime")
if ((Get-Date) -ge $target) { $target = $target.AddDays(1) }
$waitSec = [math]::Ceiling(($target - (Get-Date)).TotalSeconds)
Log "Programado commit/push para $($target.ToString('yyyy-MM-dd HH:mm:ss')) (espera ${waitSec}s)"
if ($waitSec -gt 0) { Start-Sleep -Seconds $waitSec }

Set-Location $repo
Log 'Verificando produccion ANTES del push...'
& $verifyScript -MaxAttempts 3 -IntervalSec 5
if ($LASTEXITCODE -ne 0) {
  Log 'WARN: produccion no respondio OK antes del push; continuando'
}

Log 'Iniciando git add/commit/push'
git add -A
git reset HEAD -- .env .env.local scheduled-commit-1215.log 2>$null
git status --short | Tee-Object -FilePath $log -Append

$msg = @'
feat: presupuestos borrador, asignaciones equipo-cliente e informe OT

- Autoguardado borrador presupuestos y modo finalizar; respeta precios manuales
- Tabla equipos_asignaciones con migracion, API traslado y UI historial
- Handoff ML vision: docs, seed y export de clientes/equipos
- Informe PDF OT: Diagnostico entre equipo y problema; Tareas realizadas
- Deploy: app principal online durante build + ensure_app_online post-deploy
'@

git commit -m $msg 2>&1 | Tee-Object -FilePath $log -Append
if ($LASTEXITCODE -ne 0) {
  Log "Commit fallo (exit $LASTEXITCODE), push omitido"
  exit 1
}

$newCommit = (git rev-parse HEAD).Trim()
Log "Commit OK: $newCommit"

git push origin $Branch 2>&1 | Tee-Object -FilePath $log -Append
if ($LASTEXITCODE -ne 0) {
  Log "Push fallo (exit $LASTEXITCODE)"
  exit 1
}
Log 'Push finalizado; esperando deploy en VPS y verificando produccion...'

& $verifyScript -ExpectedCommit $newCommit -MaxAttempts 40 -IntervalSec 20
if ($LASTEXITCODE -ne 0) {
  Log 'ERROR: produccion no quedo OK tras deploy - revisar GitHub Actions y VPS'
  exit 1
}
Log 'Produccion verificada OK tras deploy'
