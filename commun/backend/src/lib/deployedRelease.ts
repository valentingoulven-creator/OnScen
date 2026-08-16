import fs from 'node:fs';
import path from 'node:path';

/** SHA écrit par deploy_zero_downtime.ps1 — jamais un secret. */
export function readDeployedRelease(): string | undefined {
  const file = path.join(process.cwd(), 'DEPLOYED_SHA');
  try {
    const first = fs.readFileSync(file, 'utf8').split(/\r?\n/)[0]?.trim();
    return first || undefined;
  } catch {
    return undefined;
  }
}
