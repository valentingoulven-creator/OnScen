import { isMsdevRuntime } from './msdevGuard';
import { sendMonitoringAlert } from './alertNotifier';
import { redisIncrWithWindow } from './optionalRedis';

const daily = { day: '', count: 0 };
const hourlyByIp = new Map<string, { hour: string; count: number }>();

function utcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

function utcHour(): string {
  return new Date().toISOString().slice(0, 13);
}

function envInt(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : fallback;
}

export function resetRegistrationVolumeForTests(): void {
  daily.day = '';
  daily.count = 0;
  hourlyByIp.clear();
}

function denied(error: string): { ok: false; status: 429; error: string } {
  return { ok: false, status: 429, error };
}

function memoryAssert(ip: string | undefined, dailyCap: number, hourlyIpCap: number):
  | { ok: true }
  | { ok: false; status: 429; error: string } {
  const day = utcDay();
  if (daily.day !== day) {
    daily.day = day;
    daily.count = 0;
  }
  if (daily.count >= dailyCap) {
    void sendMonitoringAlert({
      type: 'registration_spike',
      severity: 'critical',
      message: `Plafond d'inscriptions journalier atteint (${dailyCap}).`,
      value: daily.count,
      threshold: dailyCap,
    });
    return denied('Inscriptions temporairement limitées. Réessayez plus tard.');
  }

  const clientIp = (ip || 'unknown').slice(0, 64);
  const hour = utcHour();
  const slot = hourlyByIp.get(clientIp);
  if (!slot || slot.hour !== hour) {
    hourlyByIp.set(clientIp, { hour, count: 1 });
  } else if (slot.count >= hourlyIpCap) {
    return denied('Trop d’inscriptions depuis cette connexion. Réessayez plus tard.');
  } else {
    slot.count += 1;
  }

  daily.count += 1;
  if (daily.count === Math.max(1, Math.floor(dailyCap * 0.8))) {
    void sendMonitoringAlert({
      type: 'registration_spike',
      severity: 'warning',
      message: `Inscriptions à 80 % du plafond journalier (${daily.count}/${dailyCap}).`,
      value: daily.count,
      threshold: dailyCap,
    });
  }
  return { ok: true };
}

export async function assertRegistrationVolumeAllowed(ip?: string): Promise<
  | { ok: true }
  | { ok: false; status: 429; error: string }
> {
  if (isMsdevRuntime()) return { ok: true };

  const dailyCap = envInt('REGISTRATION_DAILY_CAP', 200);
  const hourlyIpCap = envInt('REGISTRATION_HOURLY_IP_CAP', 8);
  const clientIp = (ip || 'unknown').slice(0, 64);

  const dailyCount = await redisIncrWithWindow(`regvol:day:${utcDay()}`, 90_000, dailyCap);
  if (dailyCount >= 0) {
    if (dailyCount > dailyCap) {
      void sendMonitoringAlert({
        type: 'registration_spike',
        severity: 'critical',
        message: `Plafond d'inscriptions journalier atteint (${dailyCap}).`,
        value: dailyCount,
        threshold: dailyCap,
      });
      return denied('Inscriptions temporairement limitées. Réessayez plus tard.');
    }
    const hourlyCount = await redisIncrWithWindow(
      `regvol:hour:${utcHour()}:${clientIp}`,
      3600,
      hourlyIpCap
    );
    if (hourlyCount > hourlyIpCap) {
      return denied('Trop d’inscriptions depuis cette connexion. Réessayez plus tard.');
    }
    if (dailyCount === Math.max(1, Math.floor(dailyCap * 0.8))) {
      void sendMonitoringAlert({
        type: 'registration_spike',
        severity: 'warning',
        message: `Inscriptions à 80 % du plafond journalier (${dailyCount}/${dailyCap}).`,
        value: dailyCount,
        threshold: dailyCap,
      });
    }
    return { ok: true };
  }

  return memoryAssert(ip, dailyCap, hourlyIpCap);
}
