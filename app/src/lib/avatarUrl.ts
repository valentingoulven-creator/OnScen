/** DiceBear 7.x adventurer — seed must be URL-encoded (ids with underscores, emoji, etc.). */
export function dicebearAdventurerAvatar(seed: string): string {
  return `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(seed)}`;
}

export function avatarInitialsLabel(username: string): string {
  const cleaned = username.replace(/^🤖\s*/, '').trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (parts[0]?.slice(0, 2) ?? '?').toUpperCase();
}
