import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { resolveBackupWebRoot, rootDir } from './resolve-backup-dir.mjs';

function run(cmd, args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: rootDir,
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, ...env },
    });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exit ${code}`))));
  });
}

export async function prepareBackupDemo() {
  const existing = resolveBackupWebRoot();
  if (existing) {
    console.log(`Backup iCloud trouvé: ${existing.backupDir}`);
    console.log(`Fichiers web: ${existing.source}`);
    return existing;
  }

  const fallbackDir = path.join(rootDir, 'backup', 'dist');
  console.log('Aucun backup iCloud détecté — build démo hors-ligne dans backup/dist …');
  fs.mkdirSync(path.dirname(fallbackDir), { recursive: true });

  await run('npm', ['run', 'build', '--prefix', 'app'], {
    VITE_OFFLINE_DEMO: '1',
  });

  const builtDir = path.join(rootDir, 'backend', 'public');
  fs.cpSync(builtDir, fallbackDir, { recursive: true });

  return {
    dir: fallbackDir,
    source: 'backup/dist (généré)',
    backupDir: path.join(rootDir, 'backup'),
  };
}
