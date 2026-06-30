export type IceServerConfig = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

const GOOGLE_STUN: IceServerConfig = { urls: 'stun:stun.l.google.com:19302' };

function parseTurnUrls(raw: string): string | string[] {
  const parts = raw
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return raw.trim();
  return parts.length === 1 ? parts[0] : parts;
}

/** ICE servers for WebRTC live relay — STUN public + optional TURN from env. */
export function buildIceServers(): IceServerConfig[] {
  const servers: IceServerConfig[] = [GOOGLE_STUN];
  const turnUrl = process.env.TURN_URL?.trim();
  const username = process.env.TURN_USERNAME?.trim();
  const credential = process.env.TURN_CREDENTIAL?.trim();
  if (turnUrl && username && credential) {
    servers.push({
      urls: parseTurnUrls(turnUrl),
      username,
      credential,
    });
  }
  return servers;
}
