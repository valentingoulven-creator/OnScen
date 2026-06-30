import { db, ChatMessage } from '../models/schema';
import { isDevUser } from './accessControl';

/** Valeur spéciale : dégradé Soundy (header). */
export const USERNAME_COLOR_WAVE = 'wave';

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function normalizeHex(value: string): string | undefined {
  const v = value.trim().toLowerCase();
  if (!HEX_RE.test(v)) return undefined;
  if (v.length === 4) {
    const r = v[1];
    const g = v[2];
    const b = v[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return v;
}

/** Valide et normalise une couleur pseudo ; `null` efface ; `undefined` = pas de changement. */
export function parseUsernameColorInput(
  value: unknown
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') return undefined;
  const v = value.trim().toLowerCase();
  if (v === USERNAME_COLOR_WAVE) return USERNAME_COLOR_WAVE;
  return normalizeHex(v);
}

/** Valide une couleur hex pour le dégradé wave (pas la valeur `wave`). */
export function parseUsernameWaveHexInput(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') return undefined;
  return normalizeHex(value);
}

export function usernameWaveFieldsFromUser(u: {
  usernameWaveFrom?: string;
  usernameWaveTo?: string;
}): { usernameWaveFrom?: string; usernameWaveTo?: string } {
  return {
    ...(u.usernameWaveFrom ? { usernameWaveFrom: u.usernameWaveFrom } : {}),
    ...(u.usernameWaveTo ? { usernameWaveTo: u.usernameWaveTo } : {}),
  };
}

export function hostUsernameAppearanceFields(host?: {
  usernameColor?: string;
  usernameWaveFrom?: string;
  usernameWaveTo?: string;
}): {
  hostUsernameColor?: string;
  hostUsernameWaveFrom?: string;
  hostUsernameWaveTo?: string;
} {
  if (!host) return {};
  return {
    hostUsernameColor: host.usernameColor,
    hostUsernameWaveFrom: host.usernameWaveFrom,
    hostUsernameWaveTo: host.usernameWaveTo,
  };
}

function enrichMessageWaveColors(m: ChatMessage, u: { usernameWaveFrom?: string; usernameWaveTo?: string }): ChatMessage {
  const color = m.senderUsernameColor;
  if (color !== USERNAME_COLOR_WAVE) return m;
  let out = m;
  if (!out.senderUsernameWaveFrom && u.usernameWaveFrom) {
    out = { ...out, senderUsernameWaveFrom: u.usernameWaveFrom };
  }
  if (!out.senderUsernameWaveTo && u.usernameWaveTo) {
    out = { ...out, senderUsernameWaveTo: u.usernameWaveTo };
  }
  return out;
}

export function enrichChatMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((m) => {
    const u = db.users.get(m.senderId);
    let out = m;
    if (!m.senderUsernameColor && u?.usernameColor) {
      out = { ...out, senderUsernameColor: u.usernameColor };
    }
    if (u) out = enrichMessageWaveColors(out, u);
    if (isDevUser(u)) out = { ...out, senderIsDev: true };
    return out;
  });
}
