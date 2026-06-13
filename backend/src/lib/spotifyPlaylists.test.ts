import { describe, expect, it } from 'vitest';

/** Mirrors parsePlaylistItemsPage / mapPlaylistTrack for regression on API payload shapes. */
function parsePlaylistItemsPage(data: {
  items?: Array<{ track?: { id?: string; name?: string } | null; item?: { id?: string } | null }>;
  next?: string | null;
  tracks?: {
    items?: Array<{ track?: { id?: string; name?: string } | null; item?: { id?: string } | null }>;
    next?: string | null;
  };
}) {
  if (data.items) {
    return { items: data.items, next: data.next ?? null };
  }
  return { items: data.tracks?.items ?? [], next: data.tracks?.next ?? null };
}

function mapPlaylistTrack(item: {
  track?: { id?: string; name?: string; artists?: Array<{ name?: string }> } | null;
  item?: { id?: string; name?: string; artists?: Array<{ name?: string }> } | null;
}) {
  const track = item.track ?? item.item;
  const trackId = track?.id?.trim();
  if (!track || !trackId) return null;
  const artist =
    track.artists
      ?.map((a) => a.name?.trim())
      .filter((n): n is string => Boolean(n))
      .join(', ') || 'Spotify';
  return {
    trackId,
    title: (track.name ?? 'Morceau Spotify').slice(0, 120),
    artist: artist.slice(0, 80),
  };
}

function pageHasPlayableTracks(page: {
  items: Array<{ track?: { id?: string } | null; item?: { id?: string } | null }>;
}): boolean {
  return page.items.some((item) => Boolean(mapPlaylistTrack(item)));
}

function isExternalPlaylistItemsDenied(status: number, detail?: string): boolean {
  if (status === 403) {
    const d = detail?.trim().toLowerCase() ?? '';
    if (!d || d === 'forbidden' || d === 'access denied') return true;
    if (d.includes('neither the owner nor a collaborator')) return true;
  }
  return false;
}

describe('spotify playlist page parsing', () => {
  it('reads items from GET /playlists/{id} tracks envelope', () => {
    const page = parsePlaylistItemsPage({
      tracks: {
        items: [{ track: { id: 'abc123', name: 'Song' } }],
        next: 'https://api.spotify.com/v1/next',
      },
    });
    expect(page.items.length).toBe(1);
    expect(page.next).toContain('next');
    expect(pageHasPlayableTracks(page)).toBe(true);
  });

  it('reads items from GET /playlists/{id}/items with item field (Feb 2026)', () => {
    const page = parsePlaylistItemsPage({
      items: [{ item: { id: 'xyz789', name: 'Other' } }],
      next: null,
    });
    expect(pageHasPlayableTracks(page)).toBe(true);
    expect(mapPlaylistTrack(page.items[0])?.trackId).toBe('xyz789');
  });

  it('treats metadata-only playlist (no embedded items) as empty', () => {
    const page = parsePlaylistItemsPage({
      tracks: { items: [], next: null },
    });
    expect(pageHasPlayableTracks(page)).toBe(false);
  });

  it('does not treat 200 metadata-only as playable (MODIF 485 regression)', () => {
    const userMetaOk = parsePlaylistItemsPage({
      tracks: { items: [{ track: null }, { track: null }], next: null },
    });
    expect(pageHasPlayableTracks(userMetaOk)).toBe(false);
  });
});

describe('external playlist detection', () => {
  it('flags bare 403 as external restriction', () => {
    expect(isExternalPlaylistItemsDenied(403, 'Forbidden')).toBe(true);
    expect(isExternalPlaylistItemsDenied(403, undefined)).toBe(true);
  });

  it('flags Spotify owner/collaborator message', () => {
    expect(
      isExternalPlaylistItemsDenied(
        403,
        'The user is neither the owner nor a collaborator of the playlist.'
      )
    ).toBe(true);
  });

  it('does not flag 404 as external', () => {
    expect(isExternalPlaylistItemsDenied(404, 'Not found')).toBe(false);
  });
});
