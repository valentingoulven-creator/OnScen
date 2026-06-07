/**
 * Lit MOBILE_API_URL et MOBILE_SOCKET_URL depuis msdev/.env
 * pour injecter VITE_API_URL / VITE_SOCKET_URL au build Capacitor.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const envPath = path.join(root, 'msdev', '.env');

function readEnvValue(key) {
  if (!fs.existsSync(envPath)) return undefined;
  const text = fs.readFileSync(envPath, 'utf-8');
  const re = new RegExp(`^${key}\\s*=\\s*(.+)$`, 'm');
  const m = text.match(re);
  if (!m) return undefined;
  return m[1].trim().replace(/^["']|["']$/g, '');
}

const apiUrl = readEnvValue('MOBILE_API_URL');
const socketUrl = readEnvValue('MOBILE_SOCKET_URL');

if (apiUrl) process.env.VITE_API_URL = apiUrl;
if (socketUrl) process.env.VITE_SOCKET_URL = socketUrl;

if (process.env.CAPACITOR_BUILD === '1') {
  console.log('[capacitor-build] VITE_API_URL   =', process.env.VITE_API_URL || '(relatif /api)');
  console.log('[capacitor-build] VITE_SOCKET_URL =', process.env.VITE_SOCKET_URL || '(origine courante)');
}
