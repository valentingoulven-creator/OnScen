/** Affiche un nombre compact : 999 → "999", 1000 → "1K", 1500 → "1.5K". */
export function formatCompactCount(n: number): string {
  const safe = Math.max(0, Math.floor(n));
  if (safe < 1000) return String(safe);
  if (safe < 1_000_000) {
    const val = safe / 1000;
    const text = val >= 10 ? String(Math.round(val)) : String(Math.round(val * 10) / 10);
    return `${text.replace(/\.0$/, '')}K`;
  }
  const val = safe / 1_000_000;
  const text = val >= 10 ? String(Math.round(val)) : String(Math.round(val * 10) / 10);
  return `${text.replace(/\.0$/, '')}M`;
}

/** Libellé français pour le nombre de favoris sur un profil. */
export function formatFavoritesCountLabel(count: number): string {
  const n = Math.max(0, Math.floor(count));
  if (n === 0) return '0 favoris';
  if (n === 1) return '1 favori';
  if (n < 1000) return `${n} favoris`;
  return `${formatCompactCount(n)} favoris`;
}
