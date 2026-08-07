import { describe, expect, it } from 'vitest';
import { syncEventTaggedUsersFromDescription } from './syncEventDescriptionMentions';

describe('syncEventTaggedUsersFromDescription', () => {
  it('keeps @mention in tagged users and drops removed mentions', () => {
    const first = syncEventTaggedUsersFromDescription(
      'Line-up @dj_set ce soir',
      [{ id: 'u1', username: 'dj_set' }],
      []
    );
    expect(first.eventTaggedUsers.map((u) => u.id)).toEqual(['u1']);

    const second = syncEventTaggedUsersFromDescription('Sans tag', first.mentionRefs, first.eventTaggedUsers);
    expect(second.eventTaggedUsers).toEqual([]);
    expect(second.mentionRefs).toEqual([]);
  });

  it('keeps picker-only tags without @ in text', () => {
    const synced = syncEventTaggedUsersFromDescription(
      'Infos pratiques',
      [],
      [{ id: 'u2', username: 'host' }],
      ['u2']
    );
    expect(synced.eventTaggedUsers.map((u) => u.id)).toEqual(['u2']);
  });
});
