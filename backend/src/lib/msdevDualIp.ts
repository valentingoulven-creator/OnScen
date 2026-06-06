import type { Request } from 'express';
import { getPublicLanIps } from './lanNetwork';

export interface MsdevDualUserSlot {
  slot: 'A' | 'B';
  ip: string;
  url: string;
  email: string;
  username: string;
  label: string;
  role: 'host' | 'listener';
}

export interface MsdevDualIpConfig {
  enabled: boolean;
  port: number;
  clientIp: string;
  matchedSlot: 'A' | 'B' | null;
  users: MsdevDualUserSlot[];
}

function isMsdevEnv(): boolean {
  return process.env.MSENV === 'msdev' || process.env.APP_ENV === 'msdev';
}

export function isMsdevDualIpEnabled(): boolean {
  if (!isMsdevEnv()) return false;
  if (process.env.MSDEV_DUAL_IP_ENABLED === 'false') return false;
  return process.env.MSDEV_DUAL_IP_ENABLED === 'true' || getPublicLanIps().length >= 2;
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim().replace(/^::ffff:/, '');
  }
  const raw = req.socket?.remoteAddress ?? '';
  return raw.replace(/^::ffff:/, '');
}

function defaultDualEmails(): { emailA: string; emailB: string } {
  return {
    emailA: process.env.MSDEV_DUAL_IP_EMAIL_A?.trim() || 'dj@msdev.local',
    emailB: process.env.MSDEV_DUAL_IP_EMAIL_B?.trim() || 'listener@msdev.local',
  };
}

function resolveMsdevWebScheme(): 'http' | 'https' {
  if (process.env.MSDEV_HTTPS === '1') return 'https';
  if (process.argv.includes('--https')) return 'https';
  const mobile = process.env.MOBILE_WEB_URL?.trim();
  if (mobile?.startsWith('https://')) return 'https';
  return 'http';
}

function resolveDualIp(slot: 'A' | 'B', ips: string[]): string {
  const env = slot === 'A' ? process.env.MSDEV_DUAL_IP_USER_A : process.env.MSDEV_DUAL_IP_USER_B;
  const trimmed = env?.trim();
  if (trimmed && ips.includes(trimmed)) return trimmed;
  if (slot === 'A') return ips[0] || trimmed || '192.168.1.93';
  return ips[1] || ips[0] || trimmed || '192.168.1.41';
}

export function buildMsdevDualIpConfig(port: number, clientIp?: string): MsdevDualIpConfig {
  const enabled = isMsdevDualIpEnabled();
  const ips = getPublicLanIps();
  const ipA = resolveDualIp('A', ips);
  const ipB = resolveDualIp('B', ips);
  const { emailA, emailB } = defaultDualEmails();
  const scheme = resolveMsdevWebScheme();

  const users: MsdevDualUserSlot[] = [
    {
      slot: 'A',
      ip: ipA,
      url: `${scheme}://${ipA}:${port}`,
      email: emailA,
      username: 'DJ Melody',
      label: 'Utilisateur A — hôte (salon)',
      role: 'host',
    },
    {
      slot: 'B',
      ip: ipB,
      url: `${scheme}://${ipB}:${port}`,
      email: emailB,
      username: 'Auditeur',
      label: 'Utilisateur B — participant',
      role: 'listener',
    },
  ];

  let matchedSlot: 'A' | 'B' | null = null;
  if (clientIp) {
    if (clientIp === ipA || clientIp.startsWith(`${ipA}:`)) matchedSlot = 'A';
    else if (clientIp === ipB || clientIp.startsWith(`${ipB}:`)) matchedSlot = 'B';
    else if (clientIp === '127.0.0.1' || clientIp === '::1') matchedSlot = null;
  }

  return {
    enabled,
    port,
    clientIp: clientIp ?? '',
    matchedSlot,
    users,
  };
}

export function resolveEmailForClientIp(clientIp: string, port: number): string | null {
  const cfg = buildMsdevDualIpConfig(port, clientIp);
  if (!cfg.enabled || !cfg.matchedSlot) return null;
  const slot = cfg.users.find((u) => u.slot === cfg.matchedSlot);
  return slot?.email ?? null;
}
