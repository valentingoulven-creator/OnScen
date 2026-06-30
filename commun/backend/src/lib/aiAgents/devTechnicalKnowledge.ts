/** Connaissance technique & innovation Soundy — injectée dans le contexte Dev Agent. */
export function getDevTechnicalKnowledge() {
  return {
    architecture: {
      monorepo: {
        app: 'React 19 + Vite + Tailwind v4 — source web/PWA (app/src/)',
        apptel: 'Capacitor 8 overrides mobile uniquement (ios/apptel/src/)',
        backend: 'Express TS monolithe (backend/src/) — routes /api, Socket.io',
        msdev: 'Dev local : npm run dev → :5173 + API :4080 (APP_ENV=msdev)',
        deploy: 'commun/scripts/deploy-prod.ps1 · deploy-preprod.ps1 · PM2 VPS Scaleway',
      },
      keyDomains: [
        'auth (JWT, OAuth Google/YouTube/Facebook, WebAuthn)',
        'salons sync playback + queues YouTube',
        'lives (LiveKit > Cloudflare Stream > WebRTC mesh)',
        'geo/nearby + globe 3D + stories carte',
        'reels + compositions + ACRCloud copyright scan',
        'DM/groupes + modération Sightengine + reports',
        'donations Stripe Connect + abonnements créateurs',
        'sponsors 4 placements natifs + admin analytics',
        'admin panel (accounts, content, analytics, support, agents IA)',
      ],
      dataLayer: {
        current: 'PostgreSQL + sync RAM Maps (pgStore*) — migration progressive',
        target: 'PG source de vérité + Redis cache/queues + S3 uploads (commun/docs/STACK-CIBLE.md)',
        priorityScale: 'PostGIS nearby O(n)→GiST · Redis Socket.io cluster · BullMQ async jobs',
      },
    },
    conventions: [
      'Mobile-first Tailwind : default mobile, sm:/lg: desktop',
      'dvh/dvw viewport units, touch targets 44px min',
      'Modals bottom-sheet mobile, pas de overflow-x',
      'Changelog significatif → modification.txt',
      'Ne jamais deploy prod sans demande explicite fondateur',
    ],
    innovationCatalog: [
      {
        id: 'geo-music-heatmap',
        title: 'Heatmap genres par ville + push « concert ce soir »',
        impact: 'high',
        effort: 'medium',
        why: 'Différenciation vs TikTok — lien musique + lieu IRL déjà dans le produit',
      },
      {
        id: 'salon-ai-dj',
        title: 'Co-DJ IA dans salon — suggestions morceaux selon vibe du salon',
        impact: 'high',
        effort: 'high',
        why: 'Renforce salons sync, engagement hosts',
      },
      {
        id: 'creator-studio-mobile',
        title: 'Studio créateur mobile — reel + morceau + live en un flux',
        impact: 'high',
        effort: 'medium',
        why: 'Réduit friction upload, compétition TikTok',
      },
      {
        id: 'soundy-pro-venues',
        title: 'Soundy Pro Lieu — QR entrée + playlist du lieu + sponsor local',
        impact: 'high',
        effort: 'high',
        why: 'B2B aligné GTM CEO IA, monétisation lieux',
      },
      {
        id: 'collab-rooms',
        title: 'Salons collaboratifs async — chacun ajoute un morceau, mix auto',
        impact: 'medium',
        effort: 'medium',
        why: 'Innovation sociale musique, pas copie Twitch',
      },
      {
        id: 'copyright-dashboard',
        title: 'Dashboard copyright créateur — ACRCloud + déclarations + stats blocages',
        impact: 'medium',
        effort: 'low',
        why: 'Suite logique ACRCloud déjà intégré',
      },
      {
        id: 'offline-salon-cache',
        title: 'Mode offline salon — cache playlist + reprise sync au retour réseau',
        impact: 'medium',
        effort: 'high',
        why: 'UX mobile métro/transports',
      },
      {
        id: 'referral-creator',
        title: 'Parrainage créateur avec deep links + tracking attribution',
        impact: 'medium',
        effort: 'medium',
        why: 'Croissance organique sans ads',
      },
    ],
    competitorTechGaps: {
      soundyAdvantages: [
        'Salons sync YouTube multi-users — rare sur TikTok/IG',
        'Carte/globe + présence géo + ghost mode',
        'Sponsors natifs 4 slots déjà en prod',
        'PWA + Capacitor sans réécriture RN',
      ],
      gapsToClose: [
        'IAP stores (C1) — bloquant mobile',
        'Sign in with Apple (C3) — bloquant iOS',
        'JWT httpOnly (CRIT-01) — sécurité',
        'Onboarding 9→3 étapes (C10) — rétention',
        'PostGIS scale geo (STACK-CIBLE Phase 1)',
      ],
    },
    proposalFramework: {
      alwaysInclude: [
        'Problème utilisateur / risque business',
        'Solution technique (fichiers, routes, schéma DB)',
        'Alternatives comparées (effort/risque)',
        'Plan pas-à-pas avec commandes test',
        'Métrique de succès mesurable',
        'Au moins 1 idée innovation bonus si pertinent',
      ],
      labels: ['[FACT]', '[TECH]', '[RISK]', '[INNOV]', '[ACTION]', '[HYP]'],
    },
    testCommands: {
      backend: 'cd backend && npm test',
      backendSingle: 'cd backend && npm test -- --run src/lib/<module>.test.ts',
      appBuild: 'cd app && npm run build',
      dev: 'npm run dev (racine repo)',
      verifyAccess: 'commun/scripts/verify-full-access.ps1',
    },
  };
}
