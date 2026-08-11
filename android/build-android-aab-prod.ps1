# Build AAB release Android (prod API onscen.com)
# Prérequis : JDK 21, Android SDK, keystore signé (voir ios/apptel/android/keystore.properties.example)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

$jdk21 = Get-ChildItem "C:\Program Files\Microsoft" -Directory -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -like "jdk-21*" } |
  Select-Object -First 1 -ExpandProperty FullName
if (-not $jdk21) {
  Write-Error "JDK 21 requis (winget install Microsoft.OpenJDK.21)"
}
$sdkRoot = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { "$env:USERPROFILE\Android\Sdk" }
if (-not (Test-Path "$sdkRoot\platform-tools\adb.exe")) {
  Write-Error "Android SDK introuvable. Définir ANDROID_HOME ou installer le SDK dans $sdkRoot"
}

$keystoreProps = Join-Path $root "ios\apptel\android\keystore.properties"
if (-not (Test-Path $keystoreProps)) {
  Write-Error "Fichier keystore manquant : ios/apptel/android/keystore.properties (copier depuis keystore.properties.example)"
}

$localProps = Join-Path $root "ios\apptel\android\local.properties"
$sdkDirEscaped = ($sdkRoot -replace '\\', '\\')
Set-Content -Path $localProps -Value "sdk.dir=$sdkDirEscaped`n" -Encoding ASCII

$env:JAVA_HOME = $jdk21
$env:ANDROID_HOME = $sdkRoot
$env:ANDROID_SDK_ROOT = $sdkRoot
$env:PATH = "$jdk21\bin;$sdkRoot\platform-tools;$env:PATH"

Push-Location $root
try {
  npm run build:capacitor:prod --prefix ios/apptel
  npm run cap:sync:android --prefix ios/apptel
  Push-Location (Join-Path $root "ios\apptel\android")
  try {
    .\gradlew.bat bundleRelease
  } finally {
    Pop-Location
  }
  $aabSrc = Join-Path $root "ios\apptel\android\app\build\outputs\bundle\release\app-release.aab"
  $aabDest = Join-Path $root "android\OnScen-Mobile\Soundy-release-prod.aab"
  if (Test-Path $aabSrc) {
    Copy-Item $aabSrc $aabDest -Force
    Write-Host ""
    Write-Host "AAB copié : $aabDest"
    Write-Host "Taille    : $([math]::Round((Get-Item $aabDest).Length / 1MB, 2)) Mo"
  }
} finally {
  Pop-Location
}
