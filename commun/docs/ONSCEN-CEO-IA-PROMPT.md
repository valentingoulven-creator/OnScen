# OnScen CEO IA — Prompt projet complet

Projet : **OnScen CEO IA**  
Repo : `valentingoulven-creator/OnScen` (workspace local `c:\Dev\OnScen`)  
Usage : première conversation Claude / Cursor en mode `@onscen-ceo-ia`

---

## Comment utiliser

### Dans Cursor (recommandé)

1. Ouvrir le workspace [`OnScen-CEO-IA.code-workspace`](../OnScen-CEO-IA.code-workspace) — **tout le repo est attaché**.
2. Nouvelle conversation Agent → mentionner `@onscen-ceo-ia` ou coller le prompt ci-dessous.
3. Follow-up implémentation : « Code Sprint 1 : endpoint + onglet admin CEO IA ».

### Sur Claude.ai (Projet homonyme)

1. [claude.ai](https://claude.ai) → **Projects** → **New project** → nom : `OnScen CEO IA`.
2. **Project knowledge** → connecter GitHub `valentingoulven-creator/OnScen` **ou** uploader les fichiers listés en annexe.
3. Coller le prompt **MISSION** ci-dessous en première conversation.

---

## PROMPT — CEO IA OnScen (style Tang Yu)

```markdown
# MISSION

Tu es un architecte stratégique + ingénieur IA senior. Ta mission est de concevoir et spécifier un **CEO IA** pour mon application **OnScen** (getsoundy.com), inspiré du modèle **Tang Yu** (dirigeant virtuel IA de NetDragon) : un exécutif virtuel qui analyse les données, conseille sur la stratégie, arbitre les priorités opérationnelles, modélise coûts/revenus, et produit des briefs exécutifs actionnables — **sans jamais exécuter d'actions dangereuses seul**.

Je veux un livrable **complet, implémentable dans mon repo**, pas un discours marketing vague.

---

# CONTEXTE PRODUIT — ONSCEN (SOURCE DE VÉRITÉ)

## Vision
OnScen est **le réseau social de la musique live et de l'écoute partagée** — PWA mobile-first en production sur https://getsoundy.com.

**Proposition de valeur** : unifier ce que les fans dispersent entre TikTok (découverte), Spotify (écoute), Instagram (social), Shotgun (sorties) — dans une seule app verticale musique.

## 5 onglets utilisateur (en production)
1. **Actualités** — feed social, stories, algo OnScen
2. **Carte** — événements, salons, personnes proches, bannières sponsor `map_banner`, globe 3D
3. **Direct (Live)** — vidéo LiveKit / Cloudflare HLS / mesh WebRTC fallback, chat, pourboires Stripe Connect (50 % plateforme), abonnements créateur
4. **Messages** — DMs, groupes, matching hearts (triple gate : 18+, célibataire, compte actif)
5. **Reels** — feed vertical, reels sponsorisés (1 tous les 5 par défaut)

## Features clés en production
- **Salons** YouTube synchronisés — public/privé, file d'attente, chat, ancrage carte, max 2h
- **Lives** — 3 modes : LiveKit (priorité), Cloudflare Stream RTMP→HLS, mesh WebRTC+Coturn (~30 spec max)
- **Feed / Stories / Reels** — likes, commentaires, partages, vues persistés PostgreSQL
- **Géolocalisation** — debounce, floutage, ghost mode, mode ville seule
- **Compositions** — upload audio ≤ 30 Mo (filesystem VPS)
- **Auth** — JWT, 2FA TOTP, WebAuthn, OAuth Google/YouTube/Instagram/Apple
- **Monétisation** — Stripe Connect (tips live 50 %), abonnements Supporter/Super fan (4,99–9,99 €/mois), OnScen+ (2,99–4,99 €/mois roadmap)
- **Sponsors natifs** — 4 emplacements live : `map_banner`, `feed_inline`, `stories_banner`, `reels_sponsored` — admin CRUD complet
- **Admin panel** — onglets : Comptes, Accès, Contenu (modération), Analytics/Coûts/VPS, Support (signalements), Sponsors
- **RGPD** — export données, suppression cascade, mentions légales

## Stack
React 19 + Vite + Tailwind v4 · Express + Socket.io · PostgreSQL Scaleway · LiveKit + Cloudflare Stream · Stripe Connect · VPS Scaleway 51.159.164.100 · Dev : `npm run dev` → :5173 + API :4080

## APIs admin / analytics existantes
- `GET /api/analytics/summary`
- `GET /api/admin/cloudflare-usage`
- Métriques VPS admin · Sponsors · Modération · Support

## Coûts infra (réf. docs/COUT-APPLICATION.md)
Fixe MVP ~24–28 €/mois · Cloudflare variable · LiveKit Ship ~46 €/mois si dépassement

## Modèle économique
1. Sponsors natifs (45–55 % revenu cible M24)
2. Commissions créateurs tips/abos (25–35 %)
3. OnScen+ (10–15 %)
4. B2B lieux (5–15 %)

---

# RÔLE CEO IA — RACI

## DOIT faire
Brief exécutif · modèle financier · priorisation roadmap · GTM par ville · alertes (DAU, coûts Cloudflare, VPS, modération) · path to scale avec hypothèses étiquetées

## NE DOIT JAMAIS faire seul
Bannir · modifier DB · déployer prod · contacter users/sponsors · signer engagements légaux

---

# LIVRABLES ATTENDUS

A. Persona + RACI + charte escalade  
B. System prompt production-ready (Claude API)  
C. Interface TypeScript `AiCeoBrief` (voir schéma ci-dessous)  
D. Architecture : `POST /api/admin/ai-ceo/brief`, `dataContext.ts`, `AdminAiCeoTab.tsx`  
E. 12 scénarios de test (DAU -20 %, Cloudflare ×3, 0 sponsors, etc.)  
F. Modèle financier M0→M36 (3 scénarios)  
G. Plan 3 sprints  
H. Coût API du CEO IA lui-même

## Schéma AiCeoBrief

```typescript
interface AiCeoBrief {
  generatedAt: string;
  period: string;
  healthScore: number;
  executiveSummary: string;
  northStarMetric: { name: string; current: number; target: number; trend: 'up'|'down'|'flat' };
  productHealth: { metric: string; value: number | string; trend: string; status: 'green'|'yellow'|'red' }[];
  financials: {
    costsFixedEur: number;
    costsVariableEur: number;
    costsProjectedMonthlyEur: number;
    revenueActualEur: number | null;
    revenueProjectedM12Eur: number;
    marginEur: number | null;
    burnRateEur: number | null;
    runwayMonths: number | null;
  };
  risks: { level: 'critical'|'high'|'medium'|'low'; title: string; evidence: string; mitigation: string }[];
  opportunities: { title: string; impact: 'high'|'medium'|'low'; effort: 'high'|'medium'|'low'; rationale: string }[];
  decisions: { priority: number; title: string; rationale: string; owner: 'founder'|'team'|'ceo_ai_draft'; deadline?: string }[];
  actionsThisWeek: { action: string; metric: string; owner: string }[];
  roadmapRecommendation: { horizon: '7d'|'30d'|'90d'; items: string[] }[];
  sponsorStrategy: { recommendation: string; packagesToPush: string[]; targetSegments: string[] };
  pathToBillion: { phase: string; milestone: string; requiredMetrics: Record<string, number>; timeframe: string }[];
  techDebtPriority: { issue: string; severity: string; fix: string }[];
  watchMetrics: { key: string; current: number | string; threshold: string; alertIf: string }[];
  confidence: number;
  dataGaps: string[];
}
```

---

# FORMAT DE RÉPONSE

1. 5 questions critiques si contexte insuffisant, sinon « contexte suffisant ».
2. Livrables A→H dans l'ordre.
3. Terminer par **3 actions fondateur cette semaine**.
4. Citer les fichiers source réels du repo.

Commence maintenant.
```

---

## Annexe — fichiers prioritaires (Claude Project knowledge)

Si upload manuel (limite taille), prioriser :

| Fichier | Contenu |
|---------|---------|
| `docs/OnScen-Pitch-Deck.md` | Vision investisseur |
| `docs/PLAN-SPONSORING-PAYANT.md` | Pricing sponsors |
| `docs/COUT-APPLICATION.md` | Coûts |
| `docs/INFRA-ONSCEN.md` | Infra prod |
| `docs/audit-cto-20260619.md` | Risques tech |
| `app/src/pages/AdminPage.tsx` | Admin existant |
| `backend/src/lib/analytics.ts` | Métriques |
| `modification.txt` | Historique produit |

Pour **repo complet** : connecter GitHub `valentingoulven-creator/OnScen` (branche `master`).
