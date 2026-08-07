/**
 * Échantillonnage périodique de frames pour les lives diffusés via Cloudflare Stream
 * (audit MOD-3, risque critique) : en l'absence de tout scan vidéo continu, un contenu
 * illicite diffusé en direct ne pouvait être stoppé qu'après signalement humain ou action
 * admin manuelle. Ce module capture une miniature toutes les N secondes pendant qu'un live
 * est actif, la fait scanner par Sightengine (mêmes modèles/seuils que les autres surfaces
 * image, y compris la détection de mineur — voir sightengineModeration.ts), et coupe
 * automatiquement la diffusion + alerte l'équipe admin en cas de détection.
 *
 * Limite connue (documentée, pas cachée) : ne couvre que les lives `streamMode ===
 * 'cloudflare'` (ingest RTMP/OBS). Les lives WebRTC/LiveKit purs ne sont pas couverts par
 * ce mécanisme — capturer une frame depuis une room LiveKit nécessiterait une piste
 * d'egress dédiée, hors scope de cette itération (voir modification.txt).
 */

import { db } from '../models/schema';
import { isSightengineConfigured } from './sightengineConfig';
import { checkImageWithSightengine } from './sightengineModeration';
import { appendContentReport } from './contentReports';
import { sendMonitoringAlert } from './alertNotifier';
import { getInProgressLiveThumbnailUrl, disableCloudflareLiveInput } from './cloudflareStream';
import { endLiveSession } from './liveArchive';
import { getIo } from './ioInstance';

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Intervalle entre deux captures (ms) — 60s par défaut : compromis coût Sightengine / réactivité (reco CTO). */
const SAMPLE_INTERVAL_MS = envInt('LIVE_MODERATION_SAMPLE_INTERVAL_MS', 60_000);

const activeSamplers = new Map<string, NodeJS.Timeout>();

/** Démarre l'échantillonnage pour un live Cloudflare Stream actif. Idempotent. */
export function startLiveContentSampling(liveId: string, cloudflareLiveInputId: string, hostId: string): void {
  if (!isSightengineConfigured()) return;
  if (activeSamplers.has(liveId)) return;

  const timer = setInterval(() => {
    void sampleOnce(liveId, cloudflareLiveInputId, hostId).catch((err) => {
      console.error('[live-moderation] Échec échantillonnage frame live', liveId, err);
    });
  }, SAMPLE_INTERVAL_MS);
  timer.unref?.();
  activeSamplers.set(liveId, timer);
}

/** Arrête l'échantillonnage (fin de live normale). */
export function stopLiveContentSampling(liveId: string): void {
  const timer = activeSamplers.get(liveId);
  if (timer) {
    clearInterval(timer);
    activeSamplers.delete(liveId);
  }
}

async function sampleOnce(liveId: string, cloudflareLiveInputId: string, hostId: string): Promise<void> {
  const live = db.lives.get(liveId);
  if (!live?.isActive) {
    // Nettoyage paresseux : couvre les fins de live qui ne passent pas par /lives/stop
    // (déconnexion, timeout, blocage admin) sans avoir à instrumenter chaque point de sortie.
    stopLiveContentSampling(liveId);
    return;
  }

  let thumbnailUrl: string | undefined;
  try {
    thumbnailUrl = await getInProgressLiveThumbnailUrl(cloudflareLiveInputId);
  } catch (err) {
    console.warn('[live-moderation] Miniature Cloudflare indisponible pour', liveId, err);
    return;
  }
  if (!thumbnailUrl) return;

  const apiResult = await checkImageWithSightengine(thumbnailUrl);
  if (!apiResult.ok || apiResult.evaluation.allowed) return;

  const { reason, scores } = apiResult.evaluation;
  const host = db.users.get(hostId);
  const category = reason === 'minor_risk' ? 'csam_risk' : 'illegal';

  try {
    appendContentReport({
      reporterId: 'system:sightengine-live',
      reporterUsername: 'Sightengine (détection automatique — live)',
      category,
      details: `Détection automatique sur frame échantillonnée d'un live en cours (raison : ${reason}). Scores : ${JSON.stringify(scores ?? {})}. Diffusion coupée automatiquement.`,
      targetUserId: hostId,
      roomType: 'live',
      roomId: liveId,
    });
  } catch (err) {
    console.error('[live-moderation] Échec journalisation signalement live:', err);
  }

  try {
    await sendMonitoringAlert({
      type: reason === 'minor_risk' ? 'csam_risk_detected' : 'live_content_flagged',
      severity: 'critical',
      forceSend: true,
      message:
        `Contenu suspect détecté automatiquement sur un live en cours et diffusion COUPÉE.\n` +
        `Hôte : ${host?.username ?? 'inconnu'} (${hostId}).\n` +
        `Live : ${liveId}.\n` +
        `Raison : ${reason}.\n` +
        `Scores Sightengine : ${JSON.stringify(scores ?? {})}\n\n` +
        `Action requise : vérifier manuellement en urgence l'enregistrement du live. ` +
        (reason === 'minor_risk'
          ? 'Suivre RUNBOOK-CSAM.md (préservation de preuve, signalement PHAROS/NCMEC si confirmé).'
          : 'Si contenu illicite confirmé, appliquer les sanctions prévues aux CGU.'),
    });
  } catch (err) {
    console.error('[live-moderation] Échec envoi alerte live_content_flagged:', err);
  }

  stopLiveContentSampling(liveId);
  autoEndFlaggedLive(liveId, cloudflareLiveInputId);
}

/** Coupe la diffusion (mesure conservatoire) sans attendre d'action admin manuelle. */
function autoEndFlaggedLive(liveId: string, cloudflareLiveInputId: string): void {
  const live = db.lives.get(liveId);
  if (live && live.isActive) {
    live.adminBlocked = true;
    live.adminBlockedAt = Date.now();
    endLiveSession(live, Date.now(), { reason: 'auto_moderation_flagged' });
    getIo()?.to(`live_${liveId}`).emit('live_ended', { liveId, reason: 'auto_moderation_flagged' });
  }
  disableCloudflareLiveInput(cloudflareLiveInputId).catch((err) => {
    console.warn('[live-moderation] désactivation ingest Cloudflare après flag auto:', err);
  });
}
