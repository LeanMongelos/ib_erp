# Verifica que produccion responda OK (post-push / post-deploy).
param(
  [string]$Url = 'https://erp-ibiomedica.com.ar/api/health',
  [string]$ExpectedCommit = '',
  [int]$MaxAttempts = 40,
  [int]$IntervalSec = 20
)

function Test-ProdHealth {
  param([string]$HealthUrl)
  try {
    $resp = Invoke-RestMethod -Uri $HealthUrl -TimeoutSec 30 -Method Get
    return @{
      Ok = ($resp.ok -eq $true -and $resp.db -eq 'ok')
      Body = $resp
    }
  } catch {
    return @{ Ok = $false; Body = $null; Error = $_.Exception.Message }
  }
}

for ($i = 1; $i -le $MaxAttempts; $i++) {
  $r = Test-ProdHealth -HealthUrl $Url
  $ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
  if ($r.Ok) {
    $commit = $r.Body.commit
    $expectedShort = if ($ExpectedCommit.Length -ge 12) { $ExpectedCommit.Substring(0, 12) } else { $ExpectedCommit }
    if ($ExpectedCommit -and $commit -and $commit -ne $expectedShort) {
      Write-Host "$ts - Health OK pero commit=$commit (esperado $expectedShort) intento $i/$MaxAttempts"
    } else {
      Write-Host "$ts - Produccion OK db=ok commit=$commit intento $i/$MaxAttempts"
      exit 0
    }
  } else {
    $err = if ($r.Error) { $r.Error } else { 'ok/db no OK' }
    Write-Host "$ts - Produccion no OK ($err) intento $i/$MaxAttempts"
  }
  if ($i -lt $MaxAttempts) { Start-Sleep -Seconds $IntervalSec }
}

Write-Host "ERROR: produccion no respondio OK tras $MaxAttempts intentos en $Url"
exit 1
