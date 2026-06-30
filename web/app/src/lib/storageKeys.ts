/** Canonical localStorage keys (Soundy rebrand). Legacy `soundly_*` keys are migrated on read. */
export const STORAGE_KEYS = {
  mapStyle: 'soundy_map_style',
  theaterChatDockMode: 'soundy_theater_chat_dock_mode',
  floatingChatBg: 'soundy_floating_chat_bg',
  floatingChatPos: 'soundy_floating_chat_pos',
  floatingChatSize: 'soundy_floating_chat_size',
  chatOverlayTransparent: 'soundy_chat_overlay_transparent',
  salonChatHidden: 'soundy_salon_chat_hidden',
  salonChatMinimized: 'soundy_salon_chat_minimized',
  platformPromptDismissed: 'soundy_platform_prompt_dismissed',
} as const;

const LEGACY_KEY_MAP: Record<string, string> = {
  soundly_map_style: STORAGE_KEYS.mapStyle,
  soundly_theater_chat_dock_mode: STORAGE_KEYS.theaterChatDockMode,
  soundly_floating_chat_bg: STORAGE_KEYS.floatingChatBg,
  soundly_floating_chat_pos: STORAGE_KEYS.floatingChatPos,
  soundly_floating_chat_size: STORAGE_KEYS.floatingChatSize,
  soundly_chat_overlay_transparent: STORAGE_KEYS.chatOverlayTransparent,
  soundly_salon_chat_hidden: STORAGE_KEYS.salonChatHidden,
  soundly_salon_chat_minimized: STORAGE_KEYS.salonChatMinimized,
  soundly_platform_prompt_dismissed: STORAGE_KEYS.platformPromptDismissed,
};

function migrateLegacyStorageKey(legacyKey: string): void {
  const nextKey = LEGACY_KEY_MAP[legacyKey];
  if (!nextKey || typeof localStorage === 'undefined') return;
  try {
    const val = localStorage.getItem(legacyKey);
    if (val === null) return;
    if (localStorage.getItem(nextKey) === null) localStorage.setItem(nextKey, val);
    localStorage.removeItem(legacyKey);
  } catch {
    /* ignore */
  }
}

function migrateToCanonicalKey(canonicalKey: string): void {
  for (const [legacy, next] of Object.entries(LEGACY_KEY_MAP)) {
    if (next === canonicalKey) migrateLegacyStorageKey(legacy);
  }
}

/** One-shot migration at app boot (idempotent). */
export function migrateAllLegacyStorageKeys(): void {
  if (typeof localStorage === 'undefined') return;
  Object.keys(LEGACY_KEY_MAP).forEach(migrateLegacyStorageKey);
}

export function getStorageItem(key: string): string | null {
  if (typeof localStorage === 'undefined') return null;
  migrateToCanonicalKey(key);
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setStorageItem(key: string, value: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function removeStorageItem(key: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
