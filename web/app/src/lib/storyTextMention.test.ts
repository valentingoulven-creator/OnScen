import { describe, expect, it } from 'vitest';
import {
  appendOverlayMentionRef,
  collectAllTaggedUserIds,
  collectMentionRefsFromOverlays,
  countUniqueTaggedUsers,
  filterStickerTagsNotInText,
  insertStoryMention,
  mentionTagPosition,
  mergeTaggedUsersForExport,
  parseActiveStoryMention,
  syncOverlayMentionRefs,
  textContainsMention,
} from './storyTextMention';

describe('storyTextMention', () => {
  it('parseActiveStoryMention detects @ at start and after space', () => {
    expect(parseActiveStoryMention('@mel', 4)).toEqual({
      query: 'mel',
      start: 0,
      end: 4,
    });
    expect(parseActiveStoryMention('Salut @onscen', 13)).toEqual({
      query: 'onscen',
      start: 6,
      end: 13,
    });
  });

  it('parseActiveStoryMention returns null without @', () => {
    expect(parseActiveStoryMention('hello', 5)).toBeNull();
    expect(parseActiveStoryMention('email@test.com', 14)).toBeNull();
  });

  it('insertStoryMention replaces partial query', () => {
    const result = insertStoryMention('Salut @mel', 6, 10, 'melody');
    expect(result.text).toBe('Salut @melody ');
    expect(result.cursor).toBe(14);
  });

  it('mentionTagPosition offsets stacked tags', () => {
    expect(mentionTagPosition(0.5, 0.4, 0)).toEqual({ x: 0.5, y: 0.4 });
    expect(mentionTagPosition(0.5, 0.4, 2).y).toBeCloseTo(0.51);
  });

  it('textContainsMention matches complete @username tokens', () => {
    expect(textContainsMention('@onscen_occitanie_auch <3', 'onscen_occitanie_auch')).toBe(
      true
    );
    expect(textContainsMention('Salut @user!', 'user')).toBe(true);
    expect(textContainsMention('@userx', 'user')).toBe(false);
  });

  it('syncOverlayMentionRefs prunes removed mentions', () => {
    const refs = [{ id: '1', username: 'alice' }, { id: '2', username: 'bob' }];
    expect(syncOverlayMentionRefs('Salut @alice', refs)).toEqual([
      { id: '1', username: 'alice' },
    ]);
  });

  it('appendOverlayMentionRef avoids duplicate ids', () => {
    const refs = [{ id: '1', username: 'alice' }];
    expect(
      appendOverlayMentionRef(refs, { id: '1', username: 'alice' })
    ).toEqual(refs);
    expect(
      appendOverlayMentionRef(refs, { id: '2', username: 'bob' })
    ).toHaveLength(2);
  });

  it('collectMentionRefsFromOverlays dedupes across overlays', () => {
    const overlays = [
      { text: '@alice', mentionRefs: [{ id: '1', username: 'alice' }] },
      { text: 'cc @alice', mentionRefs: [{ id: '1', username: 'alice' }] },
    ];
    expect(collectMentionRefsFromOverlays(overlays)).toEqual([
      { id: '1', username: 'alice' },
    ]);
  });

  it('countUniqueTaggedUsers merges stickers and inline mentions', () => {
    const stickers = [{ id: '9', username: 'zoe' }];
    const overlays = [
      { text: '@alice', mentionRefs: [{ id: '1', username: 'alice' }] },
    ];
    expect(countUniqueTaggedUsers(stickers, overlays)).toBe(2);
    expect(collectAllTaggedUserIds(stickers, overlays).sort()).toEqual(['1', '9']);
  });

  it('filterStickerTagsNotInText hides stickers duplicated in text', () => {
    const stickers = [
      { id: '1', username: 'alice', x: 0.5, y: 0.5 },
      { id: '2', username: 'bob', x: 0.3, y: 0.3 },
    ];
    const overlays = [
      { text: '@alice', mentionRefs: [{ id: '1', username: 'alice' }] },
    ];
    expect(filterStickerTagsNotInText(stickers, overlays)).toEqual([
      { id: '2', username: 'bob', x: 0.3, y: 0.3 },
    ]);
  });

  it('mergeTaggedUsersForExport includes inline mentions for API', () => {
    const stickers = [{ id: '2', username: 'bob' }];
    const overlays = [
      { text: '@alice', mentionRefs: [{ id: '1', username: 'alice' }] },
    ];
    const merged = mergeTaggedUsersForExport(stickers, overlays);
    expect(merged.map((t) => t.id).sort()).toEqual(['1', '2']);
  });
});
