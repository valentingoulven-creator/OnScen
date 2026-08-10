#!/usr/bin/env bash
# Build IPA iOS prod (Mac + Xcode requis)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/ios/apptel"

echo "[ios-ipa] Build Capacitor prod assets..."
npm run build:capacitor:prod

echo "[ios-ipa] Cap sync iOS..."
npx cap sync ios

echo "[ios-ipa] Archive Xcode (release)..."
# Capacitor 8 utilise Swift Package Manager (pas de Podfile/CocoaPods) : il n'y a
# donc pas de .xcworkspace généré, seulement App.xcodeproj.
xcodebuild -project ios/App/App.xcodeproj \
  -scheme App \
  -configuration Release \
  -archivePath "$ROOT/android/OnScen-Mobile/OnScen.xcarchive" \
  archive

echo "[ios-ipa] Export IPA (development/ad-hoc — ajuster ExportOptions.plist pour App Store)..."
xcodebuild -exportArchive \
  -archivePath "$ROOT/android/OnScen-Mobile/OnScen.xcarchive" \
  -exportPath "$ROOT/android/OnScen-Mobile/ios-export" \
  -exportOptionsPlist "$ROOT/ios/apptel/ios/ExportOptions.plist"

echo "IPA exporté dans android/OnScen-Mobile/ios-export/"
