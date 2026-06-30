export type AppTheme = 'dark' | 'light' | 'system';
export type ResolvedAppTheme = 'dark' | 'light';

const STORAGE_KEY = 'melosong_app_theme';
export const APP_THEME_CHANGED_EVENT = 'melosong_app_theme_changed';

export function getStoredAppTheme(): AppTheme {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === 'light' || raw === 'system') return raw;
  return 'dark';
}

export function resolveAppTheme(theme: AppTheme): ResolvedAppTheme {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  return theme;
}

export function applyAppTheme(theme: AppTheme): ResolvedAppTheme {
  const resolved = resolveAppTheme(theme);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
  return resolved;
}

export function setAppTheme(theme: AppTheme): ResolvedAppTheme {
  localStorage.setItem(STORAGE_KEY, theme);
  const resolved = applyAppTheme(theme);
  window.dispatchEvent(new CustomEvent(APP_THEME_CHANGED_EVENT, { detail: { theme, resolved } }));
  return resolved;
}

export function initAppTheme(): ResolvedAppTheme {
  return applyAppTheme(getStoredAppTheme());
}
