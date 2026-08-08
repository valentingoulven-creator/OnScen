const HIDDEN_KEY = 'onscen_map_stories_hidden';
const COLLAPSED_KEY = 'onscen_map_stories_collapsed';

export function isMapStoriesHidden(): boolean {
  try {
    return localStorage.getItem(HIDDEN_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setMapStoriesHidden(hidden: boolean): void {
  try {
    localStorage.setItem(HIDDEN_KEY, hidden ? 'true' : 'false');
  } catch {
    /* ignore */
  }
}

export function isMapStoriesCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setMapStoriesCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(COLLAPSED_KEY, collapsed ? 'true' : 'false');
  } catch {
    /* ignore */
  }
}
