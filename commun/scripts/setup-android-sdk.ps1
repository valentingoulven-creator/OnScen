# Installe Android SDK minimal pour build Gradle (Capacitor AAB/APK)
$ErrorActionPreference = "Stop"

$sdkRoot = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { "$env:USERPROFILE\Android\Sdk" }
$cmdlineDir = Join-Path $sdkRoot "cmdline-tools\latest"
$sdkmanager = Join-Path $cmdlineDir "bin\sdkmanager.bat"

if (Test-Path "$sdkRoot\platform-tools\adb.exe") {
  Write-Host "Android SDK deja present : $sdkRoot"
  exit 0
}

Write-Host "Installation Android SDK dans $sdkRoot ..."
New-Item -ItemType Directory -Force -Path $sdkRoot | Out-Null

$zipUrl = "https://dl.google.com/android/repository/commandlinetools-win-13114758_latest.zip"
$zipPath = Join-Path $env:TEMP "android-cmdline-tools-$(Get-Random).zip"
Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath -UseBasicParsing

$extractRoot = Join-Path $env:TEMP "android-cmdline-tools-extract"
if (Test-Path $extractRoot) { Remove-Item $extractRoot -Recurse -Force }
Expand-Archive -Path $zipPath -DestinationPath $extractRoot -Force

New-Item -ItemType Directory -Force -Path (Split-Path $cmdlineDir) | Out-Null
if (Test-Path $cmdlineDir) { Remove-Item $cmdlineDir -Recurse -Force }
Move-Item (Join-Path $extractRoot "cmdline-tools") $cmdlineDir

$env:ANDROID_HOME = $sdkRoot
$env:ANDROID_SDK_ROOT = $sdkRoot
$yes = "y`n" * 20
$yes | & $sdkmanager --licenses | Out-Null
& $sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0"

Write-Host "Android SDK installe : $sdkRoot"
