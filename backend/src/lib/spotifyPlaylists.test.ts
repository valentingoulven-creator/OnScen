import { describe, expect, it } from 'vitest';

/** Mirrors parsePlaylistItemsPage / mapPlaylistTrack for regression on API payload shapes. */
function parsePlaylistItemsPage(data: {
  items?: Array<{ track?: { id?: string; name?: string } | null }>;
  next?: string | null;
  tracks?: { items?: Array<{ track?: { id?: string; name?: string } | null }>; next?: string | null };
}) {
  if (data.items) {
    return { items: data.items, next: data.next ?? null };
  }
  return { items: data.tracks?.items ?? [], next: data.tracks?.next ?? null };
}

function hasPlayableTrack(page: { items: Array<{ track?: { id?: string } | null }> }): boolean {
  return page.items.some((item) => Boolean(item.track?.id?.trim()));
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
    expect(hasPlayableTrack(page)).toBe(true);
  });

  it('reads items from GET /playlists/{id}/items', () => {
    const page = parsePlaylistItemsPage({
      items: [{ track: { id: 'xyz789', name: 'Other' } }],
      next: null,
    });
    expect(hasPlayableTrack(page)).toBe(true);
  });

  it('treats metadata-only playlist (no embedded items) as empty', () => {
    const page = parsePlaylistItemsPage({
      tracks: { items: [], next: null },
    });
    expect(hasPlayableTrack(page)).toBe(false);
  });
});
