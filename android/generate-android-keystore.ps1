# Génère le keystore Android release (si absent) et met à jour mobile-store.env
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$androidDir = Join-Path $root "ios\apptel\android"
$ks = Join-Path $androidDir "soundy-release.jks"
$props = Join-Path $androidDir "keystore.properties"
$example = Join-Path $androidDir "keystore.properties.example"

$jdk21 = Get-ChildItem "C:\Program Files\Microsoft" -Directory -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -like "jdk-21*" } |
  Select-Object -First 1 -ExpandProperty FullName
if (-not $jdk21) { Write-Error "JDK 21 requis" }
$keytool = Join-Path $jdk21 "bin\keytool.exe"

# Le mot de passe keystore ne doit JAMAIS être un secret fixe committé en clair dans ce
# script (quiconque a accès au repo pourrait ressigner un build release si le .jks fuit).
# Génération aléatoire à la création ; réutilisation ensuite depuis keystore.properties
# (fichier gitignore, jamais committé) si le keystore existe déjà.
function New-RandomPassword {
  $bytes = New-Object byte[] 24
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  return [Convert]::ToBase64String($bytes) -replace '[+/=]', ''
}

function Get-KeystorePassword {
  if (Test-Path $props) {
    $line = Get-Content $props | Where-Object { $_ -match '^storePassword=' } | Select-Object -First 1
    if ($line) { return ($line -split '=', 2)[1].Trim() }
  }
  return $null
}

if (-not (Test-Path $ks)) {
  $pass = New-RandomPassword
  Write-Host "Création keystore release : $ks"
  & $keytool -genkeypair -v -keystore $ks -alias soundy -keyalg RSA -keysize 2048 -validity 10000 `
    -storepass $pass -keypass $pass `
    -dname "CN=Valentin Goulven, OU=Soundy, O=MeloSong, L=France, ST=France, C=FR"

  $propsContent = @(
    "storePassword=$pass"
    "keyPassword=$pass"
    "keyAlias=soundy"
    "storeFile=soundy-release.jks"
  ) -join "`n"
  Set-Content -Path $props -Value $propsContent -Encoding UTF8
  Write-Host "ATTENTION : mot de passe keystore généré et écrit UNIQUEMENT dans $props (gitignore)."
  Write-Host "Sauvegardez ce fichier + le .jks en lieu sûr (ex. gestionnaire de secrets) — leur perte rend impossible toute future mise à jour de l'app publiée."
} else {
  $existingPass = Get-KeystorePassword
  if (-not $existingPass) {
    Write-Error "Keystore existant mais mot de passe introuvable dans $props. Renseignez-le manuellement (storePassword=...) avant de continuer."
  }
}

$pass = Get-KeystorePassword
if (-not $pass) { Write-Error "Impossible de déterminer le mot de passe du keystore." }

$out = & $keytool -list -v -keystore $ks -alias soundy -storepass $pass 2>&1
$sha = ($out | Select-String -Pattern "SHA 256:\s*([0-9A-Fa-f:]+)").Matches[0].Groups[1].Value
Write-Host "SHA256 release : $sha"

$envFile = Join-Path $root "mobile-store.env"
$lines = if (Test-Path $envFile) { Get-Content $envFile } else { @() }
$updated = $false
$lines = $lines | ForEach-Object {
  if ($_ -match '^ANDROID_RELEASE_SHA256=') { $updated = $true; "ANDROID_RELEASE_SHA256=$sha" } else { $_ }
}
if (-not $updated) { $lines += "ANDROID_RELEASE_SHA256=$sha" }
Set-Content -Path $envFile -Value ($lines -join "`n") -Encoding UTF8
Write-Host "mobile-store.env mis à jour"

Push-Location $root
node commun/scripts/update-well-known-mobile.mjs
Pop-Location
