/**
 * Config statique des 3 environnements Soundy (source de vérité côté backend
 * pour l'onglet Admin → Environnements). Miroir de `commun/deploy/environments.ps1`
 * pour les URLs publiques — ne contient aucun secret (SSH, tokens…).
 */
export type DeployEnvironmentId = 'dev' | 'preprod' | 'prod';

export interface DeployEnvironmentConfig {
  id: DeployEnvironmentId;
  label: string;
  /** URL /health à interroger. `null` pour dev (vérifié en-process, pas de round-trip HTTP). */
  healthUrl: string | null;
  siteUrl: string;
  /** Commande manuelle de référence (jamais exécutée automatiquement). */
  deployCommand: string;
  docsPath: string;
}

export const DEPLOY_ENVIRONMENTS: Record<DeployEnvironmentId, DeployEnvironmentConfig> = {
  dev: {
    id: 'dev',
    label: 'Développement (local)',
    healthUrl: null,
    siteUrl: 'http://localhost:5173',
    deployCommand: 'npm run dev',
    docsPath: 'commun/scripts/dev-start.ps1',
  },
  preprod: {
    id: 'preprod',
    label: 'Préproduction (staging)',
    healthUrl: 'https://staging.getsoundy.com/health',
    siteUrl: 'https://staging.getsoundy.com',
    deployCommand: 'powershell -ExecutionPolicy Bypass -File commun/scripts/deploy-preprod.ps1',
    docsPath: 'commun/docs/GITHUB-ACTIONS-PREPROD.md',
  },
  prod: {
    id: 'prod',
    label: 'Production',
    healthUrl: 'https://getsoundy.com/health',
    siteUrl: 'https://getsoundy.com',
    deployCommand: 'powershell -ExecutionPolicy Bypass -File commun/scripts/deploy-prod.ps1',
    docsPath: 'commun/deploy/RUNBOOK-PROD.md',
  },
};

export function getDeployEnvironment(id: string): DeployEnvironmentConfig | null {
  if (id === 'dev' || id === 'preprod' || id === 'prod') return DEPLOY_ENVIRONMENTS[id];
  return null;
}
