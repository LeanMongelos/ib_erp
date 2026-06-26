# Genera clave privada (.key) y pedido CSR (.csr) para certificados AFIP/ARCA (WSAA/WSFE).
# Uso: .\scripts\generar-csr-afip.ps1 -Cuit "20-24440827-4"
# El contador sube el .csr en ARCA; la .key queda en storage/afip/ (no commitear).

param(
  [Parameter(Mandatory = $true)]
  [string]$Cuit
)

$ErrorActionPreference = "Stop"

$openssl = "C:\Program Files\Git\usr\bin\openssl.exe"
if (-not (Test-Path $openssl)) {
  Write-Error "No se encontró OpenSSL. Instalá Git for Windows o agregá openssl al PATH."
}

$cuitDigits = ($Cuit -replace '\D', '')
if ($cuitDigits.Length -ne 11) {
  Write-Error "CUIT inválido: debe tener 11 dígitos (recibido: $Cuit)"
}

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$outDir = Join-Path $root "storage\afip\$cuitDigits"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$keyPath = Join-Path $outDir "clave.key"
$csrPath = Join-Path $outDir "pedido.csr"

if (Test-Path $keyPath) {
  Write-Warning "Ya existe clave en $keyPath — no se sobrescribe. Borrá el archivo si querés regenerar."
} else {
  & $openssl genrsa -out $keyPath 2048
  Write-Host "Clave privada: $keyPath"
}

if (Test-Path $csrPath) {
  Write-Warning "Ya existe CSR en $csrPath — no se sobrescribe."
} else {
  & $openssl req -new -key $keyPath -subj "/CN=$cuitDigits" -out $csrPath
  Write-Host "CSR generado: $csrPath"
}

Write-Host ""
Write-Host "Enviá al contador SOLO el archivo .csr"
Write-Host "Guardá la .key en lugar seguro; luego subís .crt + .key en Configuración → Emisores"
