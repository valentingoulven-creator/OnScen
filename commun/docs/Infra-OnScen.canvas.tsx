import {
  BarChart,
  Callout,
  Card,
  CardBody,
  CardHeader,
  CollapsibleSection,
  computeDAGLayout,
  Divider,
  Grid,
  H1,
  H2,
  H3,
  Link,
  PieChart,
  Pill,
  Row,
  Spacer,
  Stack,
  Stat,
  Table,
  Text,
  UsageBar,
  useHostTheme,
} from "cursor/canvas";

/*
 * ── Mermaid (copier-coller) ─────────────────────────────────────────────
 *
 * flowchart TB
 *   subgraph Clients["Utilisateurs"]
 *     Web["React Vite — app/"]
 *     Tel["PWA — ios/apptel/"]
 *   end
 *   subgraph VPS["VPS Scaleway 51.159.164.100 · DEV1-S"]
 *     Caddy["Caddy HTTPS :443"]
 *     PM2["PM2 onscen-backend · max 512M"]
 *     Node["Node.js Express"]
 *     SIO["Socket.io temps réel"]
 *     Coturn["Coturn TURN :3478"]
 *     Uploads["/opt/onscen/public/uploads"]
 *     Dump["pg_dump cron 03:15 · 14j"]
 *   end
 *   subgraph DB["PostgreSQL Managed · 51.15.132.229:14440"]
 *     PG["DB-DEV-S · 2 Go · 10 Go SSD"]
 *     AutoBkp["Autobackup Scaleway · 7j"]
 *   end
 *   subgraph Ext["Services externes"]
 *     LK["LiveKit Build · 100 concurrents"]
 *     CF["Cloudflare Stream OBS/WHIP"]
 *     Stripe["Stripe Connect · pourboires/abos"]
 *     Gouv["geo.api.gouv.fr"]
 *     YT["YouTube OAuth"]
 *   end
 *   Web --> Caddy
 *   Tel --> Caddy
 *   Caddy --> PM2 --> Node
 *   Node --> SIO
 *   Node --> PG
 *   Node -.-> Coturn
 *   Node -.-> LK
 *   Node -.-> CF
 *   Node --> Stripe
 *   Node --> Gouv
 *   Node --> YT
 *   Node --> Uploads
 *   PG --> AutoBkp
 *   Node -.-> Dump
 *
 * flowchart LR
 *   subgraph DR["Flux sauvegarde & restauration"]
 *     App["App Node · snapshot 800ms/30s"]
 *     Cron["Cron VPS 03:15"]
 *     DumpF["soundy-*.sql.gz · 14j"]
 *     SCW["Snapshot Scaleway · 7j"]
 *     Restore["Restore test / bascule URL"]
 *   end
 *   App -->|écriture PG| PG2["PostgreSQL"]
 *   PG2 --> Cron --> DumpF
 *   PG2 --> SCW
 *   DumpF --> Restore
 *   SCW --> Restore
 * ───────────────────────────────────────────────────────────────────────
 */

const META = {
  title: "Infra OnScen",
  updated: "juin 2026",
  prodUrl: "https://getsoundy.com",
  vpsIp: "51.159.164.100",
  vpsPlan: "DEV1-S",
  dbHost: "51.15.132.229:14440",
  dbPlan: "DB-DEV-S",
  appPath: "/opt/onscen",
};

/* ── RPO / RTO par couche ── */

const RPO_RTO_ROWS: [string, string, string, string, string, string][] = [
  [
    "PostgreSQL Scaleway autobackup",
    "Automatique (console)",
    "7 jours",
    "≤ 24 h",
    "15 min – 1 h",
    "Console → Backups → Restore snapshot",
  ],
  [
    "VPS pg_dump cron",
    "Quotidien 03:15",
    "14 jours",
    "≤ 24 h",
    "30 min – 2 h",
    "/opt/onscen/backups/soundy-*.sql.gz",
  ],
  [
    "Snapshot mémoire → PostgreSQL",
    "Debounce 800 ms + boucle 30 s",
    "État courant RAM",
    "≤ 30 s",
    "Quelques secondes",
    "persist.ts · perte max entre deux flush si crash",
  ],
  [
    "Config Caddy (HTTPS)",
    "Watchdog */5 min + backup immuable",
    "Indéfinie (chattr +i)",
    "≤ 5 min",
    "≤ 5 min",
    "/root/Caddyfile.production.backup · sync-caddy.sh",
  ],
  [
    "Uploads /opt/onscen/public/uploads",
    "Aucune sauvegarde",
    "—",
    "Perte totale",
    "Non récupérable",
    "Médias utilisateur — risque majeur",
  ],
  [
    "État éphémère Socket.io (salons/lives)",
    "Mémoire processus",
    "Session courante",
    "Perte à redémarrage",
    "Immédiat (recréation)",
    "Salons/lives non persistés en DB",
  ],
];

/* ── Ressources ── */

const RESOURCE_ROWS: [string, string, string, string, string][] = [
  ["VPS DEV1-S", "1 vCPU", "~1,9 Go RAM", "~20 Go SSD", "Node, Caddy, PM2, Coturn, backups"],
  ["PM2 onscen-backend", "1 process fork", "max 512 Mo", "logs /opt/onscen/logs/", "autorestart · healthcheck */2"],
  ["Caddy", "partagé VPS", "~50–100 Mo", "config /etc/caddy/", "HTTPS getsoundy.com"],
  ["Coturn TURN", "partagé VPS", "~50–80 Mo", "—", "port 3478 · mesh WebRTC fallback"],
  ["PostgreSQL DB-DEV-S", "1 vCPU", "2 Go RAM", "10 Go SSD", "max_connections=100 · PG_POOL_MAX=10"],
  ["Backups VPS actuels", "—", "—", "~176 Ko (6 dumps)", "cron 03:15 · rétention 14 j"],
];

const RAM_VPS_TOTAL_MB = 1900;
const RAM_SEGMENTS = [
  { id: "node", label: "Node.js / PM2", value: 512 },
  { id: "caddy", label: "Caddy", value: 80 },
  { id: "coturn", label: "Coturn", value: 60 },
  { id: "os", label: "OS + cron + logs", value: 350 },
];

/* ── Tarification ── */

const PRICING_FIXED = [
  { label: "VPS Scaleway DEV1-S", value: 10, detail: "8–12 €/mo · Paris fr-par" },
  { label: "PostgreSQL DB-DEV-S", value: 15, detail: "1 vCPU · 2 Go · 10 Go SSD" },
  { label: "Domaine getsoundy.com", value: 1, detail: "~10–15 €/an" },
  { label: "Coturn (VPS)", value: 0, detail: "Inclus · port 3478" },
  { label: "LiveKit Build", value: 0, detail: "Ship ~46 €/mo si dépassement" },
  { label: "Cloudflare Stream", value: 0, detail: "1 $ / 1 000 min visionnées" },
  { label: "Stripe", value: 0, detail: "2,9 % + 0,25 €/tx · commission 50 %" },
  { label: "Scaleway Object Storage", value: 0, detail: "Non utilisé actuellement" },
];

const PRICING_MVP = PRICING_FIXED.slice(0, 3).reduce((s, p) => s + p.value, 0);

const SCENARIO_ROWS: [string, string, string, string][] = [
  ["MVP prod (~10 users)", "~24–28 €", "0 €", "~26 €"],
  ["Startup (10 lives × 20 spec.)", "~26 €", "0–7 €", "~26–32 €"],
  ["Croissance (50 lives × 200 spec.)", "~26 €", "~332 € CF", "~357 €"],
  ["Scale (100 lives × 500 spec.)", "~26 €", "~1 656 € CF", "~1 681 €"],
  ["10k users (DB-PRD-S)", "~75 €", "variable live", "~500+ €"],
];

/* ── Services externes ── */

const EXTERNAL_ROWS: [string, string, string][] = [
  [
    "LiveKit Cloud (Build)",
    "100 connexions concurrentes · 5 000 min participant/mois",
    "Caméra navigateur sans OBS · priorité streamMode #1",
  ],
  [
    "LiveKit Ship (si dépassement)",
    "~50 $/mois (~46 €)",
    "Migration si quota Build dépassé",
  ],
  [
    "Cloudflare Stream",
    "Ingest RTMP/OBS gratuit · HLS illimité",
    "1 $ / 1 000 min visionnées · WHIP phase 2",
  ],
  [
    "Stripe Connect",
    "Pourboires live + abos OnScen+/Ultra",
    "Commission plateforme 50 % · webhooks /api/donations",
  ],
  [
    "geo.api.gouv.fr",
    "API publique communes FR",
    "Recherche villes · backend/routes/geo.ts",
  ],
  [
    "Coturn (VPS)",
    "TURN relay :3478",
    "Mesh WebRTC fallback · GET /api/lives/ice-servers",
  ],
  [
    "Scaleway Object Storage",
    "Non déployé",
    "Uploads restent sur disque VPS — pas de R2/S3",
  ],
  [
    "YouTube Data API",
    "Quotas API gratuits OAuth",
    "Salons synchronisés · pas de relais média serveur",
  ],
];

const PLATFORM_PLAN_ROWS: [string, string, string][] = [
  ["Gratuit", "30 spectateurs · 2 h live/j", "LiveKit uniquement"],
  ["OnScen+ (9,99 €/mo)", "400 spectateurs · 4 h/j", "LiveKit · pas OBS/CF"],
  ["OnScenUltra (19,99 €/mo)", "Illimité", "LiveKit + OBS Cloudflare"],
];

/* ── Goulets 10k users ── */

const BOTTLENECKS_10K = [
  "DB-DEV-S insuffisant → migrer DB-PRD-S (~50 €/mo) · PG_POOL_MAX=20",
  "Processus Node unique (PM2 fork) — pas de scaling horizontal Socket.io",
  "VPS DEV1-S (~1,9 Go) — RAM/CPU limite pour pics WebSocket + API",
  "LiveKit Build : max 100 concurrents — Cloudflare obligatoire au-delà",
  "Mesh WebRTC ≤ 30 spectateurs — inutilisable à l'échelle",
  "Uploads VPS non sauvegardés — risque perte médias",
  "Connexions PG : max_connections=100 — pgBouncer recommandé à 10k+",
];

/* ── Diagrammes DAG ── */

const ARCH_NODES = [
  { id: "users", label: "Utilisateurs\nReact / PWA" },
  { id: "caddy", label: "Caddy\nHTTPS :443" },
  { id: "pm2", label: "PM2\n512M max" },
  { id: "node", label: "Node.js\nExpress" },
  { id: "sio", label: "Socket.io\nTemps réel" },
  { id: "pg", label: "PostgreSQL\nDB-DEV-S" },
  { id: "coturn", label: "Coturn\n:3478" },
  { id: "lk", label: "LiveKit\n100 conc." },
  { id: "cf", label: "Cloudflare\nStream HLS" },
  { id: "stripe", label: "Stripe\nConnect" },
  { id: "gouv", label: "geo.api.gouv.fr\nCommunes FR" },
  { id: "yt", label: "YouTube\nOAuth" },
];

const ARCH_EDGES = [
  { from: "users", to: "caddy" },
  { from: "caddy", to: "pm2" },
  { from: "pm2", to: "node" },
  { from: "node", to: "sio" },
  { from: "node", to: "pg" },
  { from: "node", to: "coturn" },
  { from: "node", to: "lk" },
  { from: "node", to: "cf" },
  { from: "node", to: "stripe" },
  { from: "node", to: "gouv" },
  { from: "node", to: "yt" },
];

const DR_NODES = [
  { id: "app", label: "App Node\nflush 800ms/30s" },
  { id: "pg", label: "PostgreSQL\nManaged" },
  { id: "cron", label: "Cron VPS\n03:15" },
  { id: "dump", label: "pg_dump\n14j rétention" },
  { id: "scw", label: "Autobackup\nScaleway 7j" },
  { id: "restore", label: "Restore\nTest / prod" },
];

const DR_EDGES = [
  { from: "app", to: "pg" },
  { from: "pg", to: "cron" },
  { from: "cron", to: "dump" },
  { from: "pg", to: "scw" },
  { from: "dump", to: "restore" },
  { from: "scw", to: "restore" },
];

function DagDiagram({
  nodes,
  edges,
  direction,
  caption,
  height = 480,
}: {
  nodes: { id: string; label: string }[];
  edges: { from: string; to: string }[];
  direction: "vertical" | "horizontal";
  caption: string;
  height?: number;
}) {
  const theme = useHostTheme();
  const layout = computeDAGLayout({
    nodes: nodes.map((n) => ({ id: n.id })),
    edges,
    direction,
    nodeWidth: 128,
    nodeHeight: 48,
    rankGap: direction === "vertical" ? 48 : 40,
    nodeGap: 20,
    padding: 12,
  });

  const nodeMeta = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const stroke = theme.stroke.secondary;
  const textColor = theme.text.primary;
  const subColor = theme.text.secondary;

  const nodeFill = (id: string) => {
    if (id === "pg") return theme.accent.control;
    if (["dump", "scw", "restore", "cron"].includes(id)) return theme.fill.tertiary;
    if (["lk", "cf", "stripe", "gouv", "yt", "coturn"].includes(id)) return theme.fill.quaternary;
    if (["caddy", "pm2", "node", "sio", "app"].includes(id)) return theme.fill.secondary;
    return theme.bg.elevated;
  };

  return (
    <Stack gap={6}>
      <svg
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        width="100%"
        style={{ maxHeight: height, display: "block" }}
        aria-label={caption}
      >
        <rect x={0} y={0} width={layout.width} height={layout.height} fill={theme.bg.editor} rx={8} />
        {layout.edges.map((e, i) => (
          <line
            key={i}
            x1={e.sourceX}
            y1={e.sourceY}
            x2={e.targetX}
            y2={e.targetY}
            stroke={stroke}
            strokeWidth={1.5}
          />
        ))}
        {layout.nodes.map((n) => {
          const meta = nodeMeta[n.id];
          const lines = meta.label.split("\n");
          return (
            <g key={n.id}>
              <rect
                x={n.x}
                y={n.y}
                width={128}
                height={48}
                rx={6}
                fill={nodeFill(n.id)}
                stroke={stroke}
                strokeWidth={1}
              />
              <text x={n.x + 64} y={n.y + 19} textAnchor="middle" fill={textColor} fontSize={10} fontWeight={600}>
                {lines[0]}
              </text>
              <text x={n.x + 64} y={n.y + 35} textAnchor="middle" fill={subColor} fontSize={8}>
                {lines[1]}
              </text>
            </g>
          );
        })}
      </svg>
      <Text style={{ color: theme.text.tertiary, fontSize: 11 }}>{caption}</Text>
    </Stack>
  );
}

export default function InfraOnScenCanvas() {
  const theme = useHostTheme();

  return (
    <Stack gap={20} style={{ padding: "4px 0 40px", maxWidth: 980 }}>
      {/* En-tête */}
      <Stack gap={6}>
        <Row gap={8} align="center" wrap>
          <H1>{META.title}</H1>
          <Pill tone="info" size="sm">
            OnScen
          </Pill>
          <Pill tone="neutral" size="sm">
            {META.updated}
          </Pill>
        </Row>
        <Text style={{ color: theme.text.secondary }}>
          Architecture production OnScen —{" "}
          <Link href={META.prodUrl}>getsoundy.com</Link> · VPS {META.vpsIp} · DB {META.dbHost}
        </Text>
        <Row gap={8} wrap>
          <Pill tone="neutral" size="sm">
            {META.vpsPlan}
          </Pill>
          <Pill tone="neutral" size="sm">
            {META.dbPlan}
          </Pill>
          <Pill tone="neutral" size="sm">
            {META.appPath}
          </Pill>
        </Row>
      </Stack>

      <Grid columns={4} gap={12}>
        <Stat label="Coût fixe MVP" value={`~${PRICING_MVP} €/mo`} tone="success" />
        <Stat label="VPS RAM" value="1,9 Go" />
        <Stat label="DB RAM" value="2 Go" />
        <Stat label="LiveKit Build" value="100 conc." tone="info" />
      </Grid>

      {/* 1. Architecture */}
      <Stack gap={8}>
        <H2>1. Architecture production</H2>
        <Text style={{ color: theme.text.tertiary, fontSize: 12 }}>
          Utilisateurs → Caddy → PM2/Node → PostgreSQL · branches Socket.io, LiveKit, Cloudflare, Coturn, Stripe,
          geo.api.gouv.fr
        </Text>
        <DagDiagram
          nodes={ARCH_NODES}
          edges={ARCH_EDGES}
          direction="vertical"
          caption={`Source : docs/COUT-APPLICATION.md · commun/deploy/README.md · ${META.updated}`}
          height={560}
        />
      </Stack>

      <Divider />

      {/* 2. RPO / RTO */}
      <Stack gap={8}>
        <H2>2. RPO / RTO par couche</H2>
        <Callout tone="info" title="RPO global pire cas">
          ≈ 24 h entre deux sauvegardes quotidiennes (VPS 03:15 + autobackup Scaleway). Snapshot mémoire limite la
          perte applicative à ≤ 30 s pour les données déjà flushées.
        </Callout>
        <Table
          headers={["Couche", "Fréquence", "Rétention", "RPO", "RTO", "Emplacement / notes"]}
          rows={RPO_RTO_ROWS}
          rowTones={RPO_RTO_ROWS.map((r) =>
            r[0].includes("Uploads") ? "danger" : r[0].includes("mémoire") ? "warning" : "neutral"
          )}
        />
      </Stack>

      <Divider />

      {/* 3. Ressources */}
      <Stack gap={8}>
        <H2>3. Ressources (RAM · CPU · disque)</H2>
        <Grid columns="1fr 1fr" gap={16}>
          <Card>
            <CardHeader title="Répartition RAM VPS (~1,9 Go)" subtitle="PM2 max_memory_restart: 512M" />
            <CardBody>
              <UsageBar
                total={RAM_VPS_TOTAL_MB}
                topLeftLabel="Composants VPS"
                topRightLabel={`${RAM_VPS_TOTAL_MB} Mo`}
                segments={RAM_SEGMENTS.map((s) => ({ id: s.id, value: s.value }))}
                style={{ marginBottom: 12 }}
              />
              <Text style={{ color: theme.text.tertiary, fontSize: 11 }}>
                Marge libre ~{RAM_VPS_TOTAL_MB - RAM_SEGMENTS.reduce((s, x) => s + x.value, 0)} Mo (~47 %)
              </Text>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Inventaire ressources" subtitle="Specs documentées · usage actuel backups ~176 Ko" />
            <CardBody>
              <Table headers={["Composant", "CPU", "RAM", "Disque", "Notes"]} rows={RESOURCE_ROWS} compact />
            </CardBody>
          </Card>
        </Grid>
      </Stack>

      <Divider />

      {/* 4. Tarification */}
      <Stack gap={8}>
        <H2>4. Tarification mensuelle (€)</H2>
        <Grid columns="1fr 1fr" gap={16}>
          <Card>
            <CardHeader title="Coûts fixes" subtitle="Source : docs/COUT-APPLICATION.md" />
            <CardBody>
              <PieChart
                data={PRICING_FIXED.filter((p) => p.value > 0).map((p) => ({ label: p.label, value: p.value }))}
                height={160}
                caption={`Total MVP fixe : ~${PRICING_MVP} €/mois (VPS + DB + domaine)`}
              />
              <Spacer />
              <Table
                headers={["Poste", "€/mois", "Détail"]}
                rows={PRICING_FIXED.map((p) => [p.label, p.value === 0 ? "0*" : `${p.value}`, p.detail])}
                compact
              />
              <Text style={{ color: theme.text.tertiary, fontSize: 11, marginTop: 8 }}>
                * Variable selon usage (streaming, transactions Stripe)
              </Text>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Scénarios MVP vs montée en charge" subtitle="Taux 1 $ ≈ 0,92 €" />
            <CardBody>
              <BarChart
                categories={SCENARIO_ROWS.map((r) => r[0].replace(" (~", "\n(~").split("\n")[0])}
                series={[
                  { name: "Infra fixe (€)", data: [26, 26, 26, 26, 75], tone: "info" },
                  { name: "Streaming (€)", data: [0, 5, 332, 1656, 200], tone: "warning" },
                ]}
                stacked
                height={200}
                yAxisLabel="Coût mensuel (€)"
                caption="Hypothèses lives caméra · 10k inclut DB-PRD-S ~50 €"
              />
              <Spacer />
              <Table
                headers={["Scénario", "Infra fixe", "Streaming", "Total estimé"]}
                rows={SCENARIO_ROWS}
                compact
              />
            </CardBody>
          </Card>
        </Grid>
      </Stack>

      <Divider />

      {/* 5. Services externes */}
      <Stack gap={8}>
        <H2>5. Services externes</H2>
        <Table headers={["Service", "Limites / modèle", "Rôle OnScen"]} rows={EXTERNAL_ROWS} />
        <Card size="sm">
          <CardHeader title="Forfaits plateforme (platformPlans.ts)" subtitle="Limites par abonnement hôte" />
          <CardBody>
            <Table headers={["Forfait", "Limites live", "Modes autorisés"]} rows={PLATFORM_PLAN_ROWS} compact />
          </CardBody>
        </Card>
        <Text style={{ color: theme.text.tertiary, fontSize: 11 }}>
          Priorité streamMode : LiveKit &gt; Cloudflare &gt; mesh WebRTC + Coturn (defaultLiveStreamMode)
        </Text>
      </Stack>

      <Divider />

      {/* 6. Backup & DR */}
      <Stack gap={8}>
        <H2>6. Sauvegarde & reprise (DR)</H2>
        <DagDiagram
          nodes={DR_NODES}
          edges={DR_EDGES}
          direction="horizontal"
          caption="Double couche : pg_dump VPS (14j) + autobackup Scaleway (7j) · restore test trimestriel recommandé"
          height={200}
        />
        <Row gap={12} wrap>
          <Pill tone="neutral" size="sm">
            verify-backup.sh
          </Pill>
          <Pill tone="neutral" size="sm">
            verify-prod.sh hebdo
          </Pill>
          <Pill tone="neutral" size="sm">
            install-backup-cron.sh
          </Pill>
        </Row>
      </Stack>

      <Divider />

      {/* 7. Goulets 10k */}
      <Stack gap={8}>
        <H2>7. Goulets d'étranglement à 10 000 utilisateurs</H2>
        <Callout tone="warning" title="Analyse scaling">
          L'infrastructure MVP actuelle (DEV1-S + DB-DEV-S + processus unique) convient à &lt; 1k users actifs. À
          10k, migration DB et architecture multi-workers requises.
        </Callout>
        <Grid columns={2} gap={10}>
          {BOTTLENECKS_10K.map((b) => (
            <Card key={b} size="sm" variant="ghost">
              <CardBody>
                <Text style={{ fontSize: 13 }}>{b}</Text>
              </CardBody>
            </Card>
          ))}
        </Grid>
      </Stack>

      {/* Références */}
      <Card variant="ghost" size="sm">
        <CardBody>
          <H3>Références & Mermaid</H3>
          <Stack gap={4}>
            <Text style={{ fontSize: 12, color: theme.text.secondary }}>
              docs/COUT-APPLICATION.md · commun/deploy/RUNBOOK-PROD.md · commun/deploy/ecosystem.config.cjs ·
              backend/src/lib/platformPlans.ts · backend/src/lib/persist.ts
            </Text>
            <Text style={{ fontSize: 11, color: theme.text.tertiary }}>
              Bloc Mermaid copiable en commentaire en tête de ce fichier (.canvas.tsx)
            </Text>
            <Row gap={12} wrap>
              <Link href="https://console.scaleway.com">Scaleway</Link>
              <Link href="https://dash.cloudflare.com">Cloudflare</Link>
              <Link href="https://cloud.livekit.io">LiveKit</Link>
              <Link href="https://dashboard.stripe.com">Stripe</Link>
              <Link href={META.prodUrl + "/health"}>Health check</Link>
            </Row>
          </Stack>
        </CardBody>
      </Card>
    </Stack>
  );
}
