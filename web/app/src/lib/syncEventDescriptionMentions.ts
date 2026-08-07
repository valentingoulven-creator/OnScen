import {
  appendOverlayMentionRef,
  syncOverlayMentionRefs,
  textContainsMention,
  type StoryTextMentionRef,
} from './storyTextMention';
import type { StoryTaggedUser, UserSearchHit } from '../types';

const MAX_EVENT_TAGS = 5;

/** Garde les tagueurs « picker » (pickerPinnedUserIds) + les @ du descriptif (max 5). */
export function syncEventTaggedUsersFromDescription(
  description: string,
  mentionRefs: StoryTextMentionRef[],
  currentTagged: StoryTaggedUser[],
  pickerPinnedUserIds: readonly string[] = []
): { mentionRefs: StoryTextMentionRef[]; eventTaggedUsers: StoryTaggedUser[] } {
  const syncedRefs = syncOverlayMentionRefs(description, mentionRefs);
  const mentionIds = new Set(syncedRefs.map((r) => r.id));
  const pinned = new Set(pickerPinnedUserIds);

  const kept: StoryTaggedUser[] = [];
  for (const u of currentTagged) {
    if (mentionIds.has(u.id) || pinned.has(u.id)) {
      if (!kept.some((x) => x.id === u.id)) kept.push(u);
    }
  }

  for (const ref of syncedRefs) {
    if (!kept.some((u) => u.id === ref.id)) {
      const prev = currentTagged.find((u) => u.id === ref.id);
      kept.push(prev ?? { id: ref.id, username: ref.username });
    }
  }

  return {
    mentionRefs: syncedRefs,
    eventTaggedUsers: kept.slice(0, MAX_EVENT_TAGS),
  };
}

export function appendEventMentionFromHit(
  _description: string,
  _mentionRefs: StoryTextMentionRef[],
  currentTagged: StoryTaggedUser[],
  hit: UserSearchHit,
  insert: { text: string; cursor: number; refs: StoryTextMentionRef[] },
  pickerPinnedUserIds: readonly string[] = []
): { description: string; mentionRefs: StoryTextMentionRef[]; eventTaggedUsers: StoryTaggedUser[]; cursor: number } {
  const nextRefs = appendOverlayMentionRef(insert.refs, {
    id: hit.id,
    username: hit.username,
  });
  let tagged = [...currentTagged];
  if (!tagged.some((u) => u.id === hit.id)) {
    tagged = [
      ...tagged,
      {
        id: hit.id,
        username: hit.username,
        avatarUrl: hit.avatarUrl,
        usernameColor: hit.usernameColor,
        usernameWaveFrom: hit.usernameWaveFrom,
        usernameWaveTo: hit.usernameWaveTo,
      },
    ];
  }
  const synced = syncEventTaggedUsersFromDescription(insert.text, nextRefs, tagged, pickerPinnedUserIds);
  return {
    description: insert.text,
    mentionRefs: synced.mentionRefs,
    eventTaggedUsers: synced.eventTaggedUsers,
    cursor: insert.cursor,
  };
}

export function inferDescriptionMentionRefs(
  description: string,
  tagged: StoryTaggedUser[]
): StoryTextMentionRef[] {
  return tagged
    .filter((u) => textContainsMention(description, u.username))
    .map((u) => ({ id: u.id, username: u.username }));
}
