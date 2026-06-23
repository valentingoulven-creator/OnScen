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
  -archivePath "$ROOT/MeloSong-Mobile/Soundy.xcarchive" \
  archive

echo "[ios-ipa] Export IPA (development/ad-hoc — ajuster ExportOptions.plist pour App Store)..."
xcodebuild -exportArchive \
  -archivePath "$ROOT/MeloSong-Mobile/Soundy.xcarchive" \
  -exportPath "$ROOT/MeloSong-Mobile/ios-export" \
  -exportOptionsPlist "$ROOT/apptel/ios/ExportOptions.plist"

echo "IPA exporté dans MeloSong-Mobile/ios-export/"
