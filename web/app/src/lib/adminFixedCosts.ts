/** Coûts fixes indicatifs — aligné sur AdminCostsTab / docs/COUT-APPLICATION.md */
export const ADMIN_FIXED_COSTS_ROWS: { label: string; amount: string; note: string }[] = [
  { label: 'VPS Scaleway (DEV1-S)', amount: '~8–12 €', note: 'Production VPS — /opt/soundy' },
  { label: 'PostgreSQL Scaleway (DB-DEV-S)', amount: '~15 €', note: 'Base managée Paris' },
  { label: 'Gmail Pro (Google Workspace)', amount: '16,90 €', note: 'Messagerie @getsoundy.com' },
  { label: 'Domaine getsoundy.com', amount: '~1 €', note: 'Renouvellement annuel ~10–15 €' },
  { label: 'Coturn TURN', amount: '0 €', note: 'Sur le même VPS' },
  { label: 'Caddy + PM2', amount: '0 €', note: 'Inclus VPS' },
];
