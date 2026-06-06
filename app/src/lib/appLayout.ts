export type AppLayoutId = 'default' | 'appa2';

const STORAGE_KEY = 'melosong_app_layout';

export const APP_LAYOUT_CHANGED_EVENT = 'melosong-app-layout-changed';

export function getAppLayout(): AppLayoutId {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw === 'appa2' ? 'appa2' : 'default';
}

export function setAppLayout(layout: AppLayoutId): void {
  localStorage.setItem(STORAGE_KEY, layout);
  window.dispatchEvent(new Event(APP_LAYOUT_CHANGED_EVENT));
}

/** Switches back to the classic layout (leaves appa2 if active). */
export function resetAppLayout(): void {
  setAppLayout('default');
}

export function isAppa2Layout(layout: AppLayoutId): boolean {
  return layout === 'appa2';
}
