# Sube certificado AFIP al VPS e instala en el ERP (storage + BD).
# Requiere acceso SSH al VPS (clave en ~/.ssh o agent).
#
# Uso:
#   .\scripts\subir-certificado-afip-vps.ps1
#   .\scripts\subir-certificado-afip-vps.ps1 -VpsHost 149.50.152.115 -VpsPort 5244

param(
  [string]$VpsHost = "149.50.152.115",
  [int]$VpsPort = 5244,
  [string]$VpsUser = "root",
  [string]$Cuit = "20-24440827-4",
  [string]$CertDesktop = "C:\Users\gasto\OneDrive\Escritorio\IB - LM DIGITAL SOLUTION_13d6250a35e5dd82 (1).crt"
)

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$digits = ($Cuit -replace '\D', '')
$localKey = Join-Path $repo "storage\afip\$digits\clave.key"
$remoteDir = "/opt/ibiomedica/storage/afip/$digits"

if (-not (Test-Path $CertDesktop)) {
  Write-Error "Certificado no encontrado: $CertDesktop"
}
if (-not (Test-Path $localKey)) {
  Write-Error "Clave privada no encontrada: $localKey"
}

Write-Host "==> Creando carpeta en VPS..."
ssh -p $VpsPort "${VpsUser}@${VpsHost}" "mkdir -p $remoteDir"

Write-Host "==> Subiendo certificado y clave..."
scp -P $VpsPort $CertDesktop "${VpsUser}@${VpsHost}:${remoteDir}/certificado.crt"
scp -P $VpsPort $localKey "${VpsUser}@${VpsHost}:${remoteDir}/clave.key"

Write-Host "==> Instalando en BD (alias IB - LM DIGITAL SOLUTION)..."
ssh -p $VpsPort "${VpsUser}@${VpsHost}" @"
cd /opt/ibiomedica && \
npx tsx scripts/instalar-certificado-afip-local.ts '$Cuit' --desde-storage --alias 'IB - LM DIGITAL SOLUTION' && \
npx tsx scripts/eliminar-emisor-cuit.ts '30-70902717-0' 2>/dev/null || true && \
pm2 restart worker-afip ibiomedica --update-env
"@

Write-Host ""
Write-Host "Listo. Verificá Configuracion -> Emisores en produccion y probá emitir en HOMOLOGACION."
