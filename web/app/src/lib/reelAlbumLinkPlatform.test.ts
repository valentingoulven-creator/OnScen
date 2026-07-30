import { describe, expect, it } from 'vitest';
import { detectAlbumLinkPlatform } from './reelAlbumLinkPlatform';

describe('detectAlbumLinkPlatform', () => {
  it('detects Spotify', () => {
    const style = detectAlbumLinkPlatform('https://open.spotify.com/album/4LH4d3eAUQHVnovOeE5odr');
    expect(style.platform).toBe('spotify');
    expect(style.label).toBe('Spotify');
  });

  it('detects Deezer', () => {
    const style = detectAlbumLinkPlatform('https://www.deezer.com/album/123456');
    expect(style.platform).toBe('deezer');
    expect(style.label).toBe('Deezer');
  });

  it('detects Soundy via parseStoryAppLink (localhost)', () => {
    const style = detectAlbumLinkPlatform(
      'http://localhost:5173/profile/user_listener?tab=compositions&album=msdev_showcase_album_01'
    );
    expect(style.platform).toBe('soundy');
    expect(style.label).toBe('Soundy');
  });

  it('detects Soundy via getsoundy.com album link', () => {
    const style = detectAlbumLinkPlatform(
      'https://getsoundy.com/profile/u1?tab=compositions&album=alb-42'
    );
    expect(style.platform).toBe('soundy');
    expect(style.label).toBe('Soundy');
  });

  it('detects Soundy for getsoundy.com even without compositions tab', () => {
    const style = detectAlbumLinkPlatform('https://getsoundy.com/profile/u1');
    expect(style.platform).toBe('soundy');
  });

  it('detects YouTube (youtube.com)', () => {
    const style = detectAlbumLinkPlatform('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(style.platform).toBe('youtube');
    expect(style.label).toBe('YouTube');
  });

  it('detects YouTube (youtu.be)', () => {
    const style = detectAlbumLinkPlatform('https://youtu.be/dQw4w9WgXcQ');
    expect(style.platform).toBe('youtube');
  });

  it('falls back to other for unknown hosts', () => {
    const style = detectAlbumLinkPlatform('https://music.apple.com/us/album/example');
    expect(style.platform).toBe('other');
    expect(style.label).toBe('Lien');
  });
});
