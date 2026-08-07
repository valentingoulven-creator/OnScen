/**
 * Ajoute un fichier audio local au catalogue d'un utilisateur msdev (store persisté).
 *
 * Usage (commun/backend) :
 *   npx tsx src/scripts/add-msdev-composition-from-file.ts --file "C:\path\track.mp3" --user prod-seed-bot-beat-castel --title "Lost (Live)" --artist "Linkin Park"
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), '../msdev/.env') });
process.env.APP_ENV = 'msdev';

import { createUserComposition } from '../lib/compositions';
import { getPublicDir } from '../paths';
import { loadPersistedStore, schedulePersist, savePersistedStore } from '../lib/persist';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i < 0 || i + 1 >= process.argv.length) return undefined;
  return process.argv[i + 1];
}

const filePath = arg('--file');
const userId = arg('--user');
const title = arg('--title') ?? 'Sans titre';
const artist = arg('--artist');

if (!filePath || !userId) {
  console.error(
    'Usage: npx tsx src/scripts/add-msdev-composition-from-file.ts --file <path> --user <userId> [--title] [--artist]'
  );
  process.exit(1);
}

const abs = path.resolve(filePath);
if (!fs.existsSync(abs)) {
  console.error(`Fichier introuvable: ${abs}`);
  process.exit(1);
}

const stat = fs.statSync(abs);
if (stat.size > 30 * 1024 * 1024) {
  console.error('Fichier > 30 Mo');
  process.exit(1);
}

const restored = loadPersistedStore();
if (!restored) {
  console.error('Store msdev introuvable — lancez npm run dev une première fois.');
  process.exit(1);
}

const uploadsDir = path.join(getPublicDir(), 'uploads', 'compositions');
fs.mkdirSync(uploadsDir, { recursive: true });
const filename = `${crypto.randomBytes(12).toString('hex')}.mp3`;
const dest = path.join(uploadsDir, filename);
fs.copyFileSync(abs, dest);
const fileUrl = `/uploads/compositions/${filename}`;

(async () => {
  const result = await createUserComposition(userId, {
    title,
    artist,
    fileUrl,
    rightsConfirmed: true,
  });
  if ('error' in result) {
    console.error(result.error);
    try {
      fs.unlinkSync(dest);
    } catch {
      /* ignore */
    }
    process.exit(1);
  }
  schedulePersist();
  savePersistedStore();
  console.log('[add-msdev-composition] OK', result);
  process.exit(0);
})();
