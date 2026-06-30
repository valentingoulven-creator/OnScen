const STORAGE_KEY = 'melosong_salon_show_youtube_video';

export function getSalonShowYoutubeVideo(): boolean {
  if (typeof localStorage === 'undefined') return true;
  const v = localStorage.getItem(STORAGE_KEY);
  return v !== '0' && v !== 'false';
}

export function setSalonShowYoutubeVideo(show: boolean): void {
  localStorage.setItem(STORAGE_KEY, show ? '1' : '0');
}
