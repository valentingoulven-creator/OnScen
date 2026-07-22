import fs from 'fs';

/**
 * Met à jour (ou ajoute) des paires clé=valeur dans un fichier .env, en
 * conservant les lignes non concernées (commentaires, autres variables).
 * Même logique que `updateEnvFile` (msdevLanConfig.ts) mais générique pour
 * tout jeu de clés — utilisé pour appliquer la config Stripe live depuis
 * l'admin sans redéploiement complet.
 */
export function upsertEnvFileKeys(envPath: string, updates: Record<string, string>): void {
  const lines = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8').split(/\r?\n/) : [];
  const seen = new Set<string>();
  const out = lines.map((line) => {
    for (const [key, val] of Object.entries(updates)) {
      const re = new RegExp(`^\\s*${key}\\s*=`);
      if (re.test(line)) {
        seen.add(key);
        return `${key}=${val}`;
      }
    }
    return line;
  });
  for (const [key, val] of Object.entries(updates)) {
    if (!seen.has(key)) out.push(`${key}=${val}`);
  }
  fs.writeFileSync(envPath, out.join('\n').replace(/\n*$/, '\n'));
}
