const KEY = 'melosong_support_clicks';

export function getSupportClickCount(): number {
  const n = Number(localStorage.getItem(KEY));
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

export function incrementSupportClick(): number {
  const next = getSupportClickCount() + 1;
  localStorage.setItem(KEY, String(next));
  return next;
}
