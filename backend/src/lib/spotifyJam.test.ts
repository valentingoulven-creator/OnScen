import { describe, expect, it } from 'vitest';
import { normalizeSpotifyJamUrl, parseSpotifyJamLink } from './spotifyJam';

describe('parseSpotifyJamLink', () => {
  it('accepte une URL open.spotify.com/socialsession', () => {
    const parsed = parseSpotifyJamLink(
      'https://open.spotify.com/socialsession/abc123XYZ?si=foo'
    );
    expect(parsed).toEqual({
      kind: 'socialsession',
      sessionId: 'abc123XYZ',
      url: 'https://open.spotify.com/socialsession/abc123XYZ',
      uri: 'spotify:socialsession:abc123XYZ',
    });
  });

  it('accepte une URI spotify:socialsession', () => {
    const parsed = parseSpotifyJamLink('spotify:socialsession:token42');
    expect(parsed?.kind).toBe('socialsession');
    expect(parsed?.sessionId).toBe('token42');
    expect(parsed?.url).toBe('https://open.spotify.com/socialsession/token42');
  });

  it('accepte un lien court spotify.link', () => {
    const parsed = parseSpotifyJamLink('https://spotify.link/ytWX995m63b');
    expect(parsed).toEqual({
      kind: 'spotify_link',
      url: 'https://spotify.link/ytWX995m63b',
    });
  });

  it('normalise spotify.link sans schéma https', () => {
    const parsed = parseSpotifyJamLink('spotify.link/abc-def_12');
    expect(parsed?.url).toBe('https://spotify.link/abc-def_12');
  });

  it('refuse un lien morceau Spotify', () => {
    expect(
      parseSpotifyJamLink('https://open.spotify.com/track/2P91MQbaiQKBR4c9sEgqsl')
    ).toBeNull();
  });

  it('refuse une chaîne vide', () => {
    expect(parseSpotifyJamLink('   ')).toBeNull();
  });
});

describe('normalizeSpotifyJamUrl', () => {
  it('retourne l’URL canonique socialsession', () => {
    expect(normalizeSpotifyJamUrl('spotify:socialsession:abc')).toBe(
      'https://open.spotify.com/socialsession/abc'
    );
  });

  it('conserve un lien spotify.link normalisé', () => {
    expect(normalizeSpotifyJamUrl('https://spotify.link/ytWX995m63b')).toBe(
      'https://spotify.link/ytWX995m63b'
    );
  });
});
