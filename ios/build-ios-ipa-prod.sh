#!/usr/bin/env bash
# Build IPA iOS prod (Mac + Xcode requis)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/apptel"

echo "[ios-ipa] Build Capacitor prod assets..."
npm run build:capacitor:prod

echo "[ios-ipa] Cap sync iOS..."
npx cap sync ios

echo "[ios-ipa] Archive Xcode (release)..."
xcodebuild -workspace ios/App/App.xcworkspace \
  -scheme App \
  -configuration Release \
  -archivePath "$ROOT/android/MeloSong-Mobile/Soundy.xcarchive" \
  archive

echo "[ios-ipa] Export IPA (development/ad-hoc — ajuster ExportOptions.plist pour App Store)..."
xcodebuild -exportArchive \
  -archivePath "$ROOT/android/MeloSong-Mobile/Soundy.xcarchive" \
  -exportPath "$ROOT/android/MeloSong-Mobile/ios-export" \
  -exportOptionsPlist "$ROOT/ios/apptel/ios/ExportOptions.plist"

echo "IPA exporté dans android/MeloSong-Mobile/ios-export/"
