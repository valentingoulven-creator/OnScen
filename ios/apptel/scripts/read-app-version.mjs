import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const apptelRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function readAppVersion() {
  const raw = JSON.parse(fs.readFileSync(path.join(apptelRoot, 'app-version.json'), 'utf8'));
  const name = String(raw.name ?? '').trim();
  const code = Number(raw.code);
  if (!name || !Number.isFinite(code)) {
    throw new Error('ios/apptel/app-version.json invalide (name + code requis)');
  }
  return { name, code };
}

export function syncIosPbxproj({ name, code }) {
  const pbx = path.join(apptelRoot, 'ios/App/App.xcodeproj/project.pbxproj');
  if (!fs.existsSync(pbx)) {
    console.warn('[app-version] project.pbxproj introuvable, sync iOS ignorée.');
    return;
  }
  let content = fs.readFileSync(pbx, 'utf8');
  const next = content
    .replace(/CURRENT_PROJECT_VERSION = \d+;/g, `CURRENT_PROJECT_VERSION = ${code};`)
    .replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${name};`);
  if (next !== content) {
    fs.writeFileSync(pbx, next, 'utf8');
    console.log(`[app-version] iOS → ${name} (${code})`);
  }
}
