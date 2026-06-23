# Build APK debug Android (prod API getsoundy.com)
# Prérequis : JDK 21, Android SDK (ANDROID_HOME)
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

$localProps = Join-Path $root "apptel\android\local.properties"
$sdkDirEscaped = ($sdkRoot -replace '\\', '\\')
Set-Content -Path $localProps -Value "sdk.dir=$sdkDirEscaped`n" -Encoding ASCII

$env:JAVA_HOME = $jdk21
$env:ANDROID_HOME = $sdkRoot
$env:ANDROID_SDK_ROOT = $sdkRoot
$env:PATH = "$jdk21\bin;$sdkRoot\platform-tools;$env:PATH"

Push-Location $root
try {
  npm run capacitor:android:apk:prod
  $apkSrc = Join-Path $root "apptel\android\app\build\outputs\apk\debug\app-debug.apk"
  $apkDest = Join-Path $root "MeloSong-Mobile\Soundy-debug-prod.apk"
  if (Test-Path $apkSrc) {
    Copy-Item $apkSrc $apkDest -Force
    Write-Host ""
    Write-Host "APK copié : $apkDest"
    Write-Host "Taille    : $([math]::Round((Get-Item $apkDest).Length / 1MB, 2)) Mo"
  }
} finally {
  Pop-Location
}
