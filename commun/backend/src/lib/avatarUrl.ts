/** DiceBear 7.x adventurer — stable bot/user avatars (avoid deprecated or broken styles). */
export function dicebearAdventurerAvatar(seed: string): string {
  return `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(seed)}`;
}
