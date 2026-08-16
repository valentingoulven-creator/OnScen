#!/usr/bin/env node
/**
 * Patch idempotent du projet Android natif généré par `npx cap add android`.
 *
 * `ios/apptel/android/` est intégralement gitignoré (cf. `.gitignore` ligne
 * `android`) — aucune personnalisation native (permissions, deep links,
 * targetSdk, FileProvider) ne survit à une suppression du dossier ou à un
 * clone frais. Avant ce script, ces personnalisations n'existaient que sur
 * une machine de dev, reproductibles uniquement « à la main » sans trace
 * écrite. Ce script les réapplique automatiquement après `cap add android`,
 * ce qui rend le projet reproductible en CI et sur toute nouvelle machine.
 *
 * Usage : node scripts/patch-android-native.mjs (depuis ios/apptel/)
 *         appelé automatiquement par `npm run cap:add:android`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readAppVersion } from './read-app-version.mjs';

const apptelRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { name: VERSION_NAME, code: VERSION_CODE } = readAppVersion();
const androidRoot = path.join(apptelRoot, 'android');
const manifestPath = path.join(androidRoot, 'app/src/main/AndroidManifest.xml');
const variablesPath = path.join(androidRoot, 'variables.gradle');
const stringsPath = path.join(androidRoot, 'app/src/main/res/values/strings.xml');
const leftoverMelosongDir = path.join(androidRoot, 'app/src/main/java/com/melosong');

if (!fs.existsSync(androidRoot)) {
  console.error('[patch-android-native] ios/apptel/android/ absent — lancer "npx cap add android" avant ce script.');
  process.exit(1);
}

const TARGET_SDK = 36; // Exigence Google Play : API 36 obligatoire pour toute nouvelle app/mise à jour au 31/08/2026.

function patchAppVersion() {
  const gradlePath = path.join(androidRoot, 'app/build.gradle');
  if (!fs.existsSync(gradlePath)) {
    console.warn('[patch-android-native] app/build.gradle introuvable, version ignorée.');
    return;
  }
  let content = fs.readFileSync(gradlePath, 'utf8');
  const before = content;
  content = content.replace(/versionCode\s+\d+/, `versionCode ${VERSION_CODE}`);
  content = content.replace(/versionName\s+"[^"]+"/, `versionName "${VERSION_NAME}"`);
  if (content !== before) {
    fs.writeFileSync(gradlePath, content, 'utf8');
    console.log(`[patch-android-native] version → ${VERSION_NAME} (${VERSION_CODE})`);
  } else {
    console.log('[patch-android-native] version déjà à jour.');
  }
}

function patchVariablesGradle() {
  if (!fs.existsSync(variablesPath)) {
    console.warn('[patch-android-native] variables.gradle introuvable, étape ignorée.');
    return;
  }
  let content = fs.readFileSync(variablesPath, 'utf8');
  const before = content;
  content = content.replace(/compileSdkVersion\s*=\s*\d+/, `compileSdkVersion = ${TARGET_SDK}`);
  content = content.replace(/targetSdkVersion\s*=\s*\d+/, `targetSdkVersion = ${TARGET_SDK}`);
  if (content !== before) {
    fs.writeFileSync(variablesPath, content, 'utf8');
    console.log(`[patch-android-native] variables.gradle : compileSdk/targetSdk → ${TARGET_SDK}`);
  } else {
    console.log('[patch-android-native] variables.gradle déjà à jour.');
  }
}

// AndroidManifest.xml complet et connu-bon (build Gradle validé le 22/07/2026) :
// permissions alignées sur ios/apptel/ios/App/App/Info.plist (micro, caméra, localisation,
// photos, notifications), deep links /salon /live /profile (miroir AASA iOS), networkSecurityConfig
// pour le cert pinning (fetch-cert-pins.mjs), FileProvider pour le partage de fichiers (Camera/Share).
const MANIFEST_CONTENT = `<?xml version="1.0" encoding="utf-8"?>
<!-- Régénéré par ios/apptel/scripts/patch-android-native.mjs après "cap add android" — ne pas éditer
     directement (android/ est gitignoré, toute édition manuelle est perdue au prochain "cap add android"). -->
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- Permissions -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
    <uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

    <uses-feature android:name="android.hardware.camera" android:required="false" />
    <uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />
    <uses-feature android:name="android.hardware.location.gps" android:required="false" />

    <application
        android:allowBackup="false"
        android:fullBackupContent="false"
        android:dataExtractionRules="@xml/data_extraction_rules"
        android:networkSecurityConfig="@xml/network_security_config"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/AppTheme">

        <activity
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode|navigation|density"
            android:name=".MainActivity"
            android:label="@string/title_activity_main"
            android:theme="@style/AppTheme.NoActionBarLaunch"
            android:launchMode="singleTask"
            android:exported="true">

            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>

            <intent-filter android:autoVerify="true">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="https" android:host="onscen.com" android:pathPrefix="/salon" />
                <data android:scheme="https" android:host="www.onscen.com" android:pathPrefix="/salon" />
                <data android:scheme="https" android:host="onscen.com" android:pathPrefix="/tel/salon" />
                <data android:scheme="https" android:host="www.onscen.com" android:pathPrefix="/tel/salon" />
            </intent-filter>
            <intent-filter android:autoVerify="true">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="https" android:host="onscen.com" android:pathPrefix="/live" />
                <data android:scheme="https" android:host="www.onscen.com" android:pathPrefix="/live" />
                <data android:scheme="https" android:host="onscen.com" android:pathPrefix="/tel/live" />
                <data android:scheme="https" android:host="www.onscen.com" android:pathPrefix="/tel/live" />
            </intent-filter>
            <intent-filter android:autoVerify="true">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="https" android:host="onscen.com" android:pathPrefix="/profile" />
                <data android:scheme="https" android:host="www.onscen.com" android:pathPrefix="/profile" />
                <data android:scheme="https" android:host="onscen.com" android:pathPrefix="/tel/profile" />
                <data android:scheme="https" android:host="www.onscen.com" android:pathPrefix="/tel/profile" />
            </intent-filter>
            <intent-filter android:autoVerify="true">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="https" android:host="onscen.com" android:pathPrefix="/reels" />
                <data android:scheme="https" android:host="www.onscen.com" android:pathPrefix="/reels" />
                <data android:scheme="https" android:host="onscen.com" android:pathPrefix="/tel/reels" />
                <data android:scheme="https" android:host="www.onscen.com" android:pathPrefix="/tel/reels" />
            </intent-filter>
            <intent-filter android:autoVerify="true">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="https" android:host="onscen.com" android:pathPrefix="/auth" />
                <data android:scheme="https" android:host="www.onscen.com" android:pathPrefix="/auth" />
                <data android:scheme="https" android:host="onscen.com" android:pathPrefix="/tel/auth" />
                <data android:scheme="https" android:host="www.onscen.com" android:pathPrefix="/tel/auth" />
            </intent-filter>

        </activity>

        <provider
            android:name="androidx.core.content.FileProvider"
            android:authorities="\${applicationId}.fileprovider"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/file_paths"></meta-data>
        </provider>
    </application>

</manifest>
`;

function patchManifest() {
  fs.writeFileSync(manifestPath, MANIFEST_CONTENT, 'utf8');
  console.log('[patch-android-native] AndroidManifest.xml réécrit (permissions + deep links + FileProvider).');
}

/** Aligne le nom sous l'icône sur iOS (`CFBundleDisplayName` = OnScen). */
function patchStringsXml() {
  if (!fs.existsSync(stringsPath)) {
    console.warn('[patch-android-native] strings.xml introuvable, étape ignorée.');
    return;
  }
  let content = fs.readFileSync(stringsPath, 'utf8');
  const before = content;
  content = content.replace(
    /(<string name="app_name">)[^<]+(<\/string>)/,
    '$1OnScen$2',
  );
  content = content.replace(
    /(<string name="title_activity_main">)[^<]+(<\/string>)/,
    '$1OnScen$2',
  );
  if (content !== before) {
    fs.writeFileSync(stringsPath, content, 'utf8');
    console.log('[patch-android-native] strings.xml : app_name / title → OnScen');
  } else {
    console.log('[patch-android-native] strings.xml déjà à jour (OnScen).');
  }
}

function removeLeftoverMelosongPackage() {
  if (!fs.existsSync(leftoverMelosongDir)) return;
  fs.rmSync(leftoverMelosongDir, { recursive: true, force: true });
  console.log('[patch-android-native] dossier Java résiduel com.melosong supprimé.');
}

patchVariablesGradle();
patchAppVersion();
patchManifest();
patchStringsXml();
removeLeftoverMelosongPackage();

const iconScript = path.join(apptelRoot, '../../commun/scripts/apply-app-icon.mjs');
if (fs.existsSync(iconScript)) {
  const r = spawnSync(process.execPath, [iconScript], { stdio: 'inherit' });
  if (r.status !== 0) {
    console.warn('[patch-android-native] apply-app-icon a échoué (icônes Android non régénérées).');
  }
}
console.log(
  '[patch-android-native] Terminé. Pense à lancer "npm run mobile:cert-pins" (racine) pour générer' +
    ' network_security_config.xml si absent, puis "npx cap sync android".'
);
