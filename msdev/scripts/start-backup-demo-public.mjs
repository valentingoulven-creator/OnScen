import fs from 'fs';
import path from 'path';
import { prepareBackupDemo } from './prepare-backup-demo.mjs';
import { resolveBackupDir, WINDOWS_ICLOUD_DEFAULT } from './resolve-backup-dir.mjs';
import { startStaticServer } from './serve-static-dir.mjs';
import {
  checkHttpPort,
  msdevDir,
  startPublicTunnel,
  waitForPort,
} from './start-public-tunnel.mjs';

const port = Number(process.env.BACKUP_DEMO_PORT) || 5190;
const urlFile = path.join(msdevDir, 'PUBLIC-BACKUP-URL.txt');

async function main() {
  console.log('\nMeloSong — démo depuis dossier backup (sans serveur backend)\n');

  const backupDir = resolveBackupDir();
  if (backupDir) {
    console.log(`Dossier backup: ${backupDir}`);
  } else {
    console.log('Dossier backup iCloud non trouvé sur cette machine.');
    console.log(`Chemin attendu (Windows): ${WINDOWS_ICLOUD_DEFAULT}`);
    console.log('Ou définissez MELOSONG_BACKUP_PATH vers votre dossier backup.\n');
  }

  const web = await prepareBackupDemo();
  console.log(`\nServir: ${web.dir}`);

  if (!(await checkHttpPort(port))) {
    await startStaticServer(web.dir, port);
    if (!(await waitForPort(port))) {
      console.error(`Impossible d’écouter le port ${port}`);
      process.exit(1);
    }
  } else {
    console.log(`Serveur déjà actif sur http://localhost:${port}`);
  }

  const hint = `Source: ${web.source}
Sans backend — fichiers statiques du dossier backup
Compte démo (si app offline): connexion automatique badge DEMO
Compte démo (si app msdev build): listener@msdev.local / msdev123`;

  startPublicTunnel({
    port,
    urlFile,
    label: 'backup iCloud (sans serveur)',
    hint,
  });

  fs.writeFileSync(
    urlFile,
    `MeloSong — démo backup iCloud (sans serveur backend)

Voir l’URL affichée dans le terminal (tunnel Cloudflare).

Dossier source: ${web.dir}
Relancer: npm run backup:demo:public
`,
    'utf8'
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
