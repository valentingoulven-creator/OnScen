const STORAGE_KEY = 'soundy_saved_event_location';

export function readSavedEventLocation(): string | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    const trimmed = value?.trim();
    return trimmed || null;
  } catch {
    return null;
  }
}

export function writeSavedEventLocation(location: string): void {
  try {
    const trimmed = location.trim();
    if (!trimmed) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, trimmed);
  } catch {
    // ignore quota / private mode
  }
}
