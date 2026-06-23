# Génère le keystore Android release (si absent) et met à jour mobile-store.env
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$androidDir = Join-Path $root "apptel\android"
$ks = Join-Path $androidDir "soundy-release.jks"
$props = Join-Path $androidDir "keystore.properties"
$example = Join-Path $androidDir "keystore.properties.example"

$jdk21 = Get-ChildItem "C:\Program Files\Microsoft" -Directory -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -like "jdk-21*" } |
  Select-Object -First 1 -ExpandProperty FullName
if (-not $jdk21) { Write-Error "JDK 21 requis" }
$keytool = Join-Path $jdk21 "bin\keytool.exe"

if (-not (Test-Path $ks)) {
  $pass = "SoundyRelease2026!"
  Write-Host "Création keystore release : $ks"
  & $keytool -genkeypair -v -keystore $ks -alias soundy -keyalg RSA -keysize 2048 -validity 10000 `
    -storepass $pass -keypass $pass `
    -dname "CN=Valentin Goulven, OU=Soundy, O=MeloSong, L=France, ST=France, C=FR"
  if (-not (Test-Path $props)) {
    Copy-Item $example $props
    Write-Host "Copié keystore.properties — changez les mots de passe avant prod publique"
  }
}

$out = & $keytool -list -v -keystore $ks -alias soundy -storepass "SoundyRelease2026!" 2>&1
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
node scripts/update-well-known-mobile.mjs
Pop-Location
