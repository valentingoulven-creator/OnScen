/** DiceBear 7.x adventurer — seed must be URL-encoded (ids with underscores, emoji, etc.). */
export function dicebearAdventurerAvatar(seed: string): string {
  return `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(seed)}`;
}

/** True when the URL is a generated DiceBear placeholder (not a user-uploaded photo). */
export function isDicebearAvatarUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  try {
    return new URL(trimmed).hostname.includes('api.dicebear.com');
  } catch {
    return trimmed.includes('api.dicebear.com');
  }
}

export function avatarInitialsLabel(username: string): string {
  const cleaned = username.replace(/^🤖\s*/, '').trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (parts[0]?.slice(0, 2) ?? '?').toUpperCase();
}
