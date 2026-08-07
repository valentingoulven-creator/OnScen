import { useRef, useState, type TextareaHTMLAttributes } from 'react';
import {
  insertStoryMention,
  parseActiveStoryMention,
  type ActiveStoryMention,
  type StoryTextMentionRef,
} from '../lib/storyTextMention';
import { appendEventMentionFromHit, syncEventTaggedUsersFromDescription } from '../lib/syncEventDescriptionMentions';
import type { StoryTaggedUser, UserSearchHit } from '../types';
import { StoryMentionAutocomplete } from './StoryMentionAutocomplete';

const MAX_EVENT_TAGS = 5;

type MentionTextareaProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  'value' | 'onChange'
> & {
  token: string;
  value: string;
  onChange: (value: string) => void;
  mentionRefs: StoryTextMentionRef[];
  onMentionRefsChange: (refs: StoryTextMentionRef[]) => void;
  eventTaggedUsers: StoryTaggedUser[];
  onEventTaggedUsersChange: (users: StoryTaggedUser[]) => void;
  /** Utilisateurs tagués via le picker « plus d’options », conservés sans @ dans le texte. */
  pickerPinnedUserIds?: string[];
  maxMentions?: number;
};

export function MentionTextarea({
  token,
  value,
  onChange,
  mentionRefs,
  onMentionRefsChange,
  eventTaggedUsers,
  onEventTaggedUsersChange,
  pickerPinnedUserIds = [],
  maxMentions = MAX_EVENT_TAGS,
  className,
  ...textareaProps
}: MentionTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [activeMention, setActiveMention] = useState<ActiveStoryMention | null>(null);

  const syncMentionState = (text: string, cursor: number) => {
    setActiveMention(parseActiveStoryMention(text, cursor));
  };

  const applyTextChange = (text: string, cursor: number, refs: StoryTextMentionRef[]) => {
    const synced = syncEventTaggedUsersFromDescription(text, refs, eventTaggedUsers, pickerPinnedUserIds);
    onChange(text);
    onMentionRefsChange(synced.mentionRefs);
    onEventTaggedUsersChange(synced.eventTaggedUsers);
    syncMentionState(text, cursor);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    const cursor = e.target.selectionStart ?? text.length;
    applyTextChange(text, cursor, mentionRefs);
  };

  const handleSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    syncMentionState(el.value, el.selectionStart ?? el.value.length);
  };

  const handleMentionSelect = (hit: UserSearchHit) => {
    if (!activeMention) return;
    if (eventTaggedUsers.length >= maxMentions && !eventTaggedUsers.some((u) => u.id === hit.id)) {
      return;
    }
    const inserted = insertStoryMention(value, activeMention.start, activeMention.end, hit.username);
    const next = appendEventMentionFromHit(value, mentionRefs, eventTaggedUsers, hit, {
      text: inserted.text,
      cursor: inserted.cursor,
      refs: mentionRefs,
    }, pickerPinnedUserIds);
    onChange(next.description);
    onMentionRefsChange(next.mentionRefs);
    onEventTaggedUsersChange(next.eventTaggedUsers);
    setActiveMention(null);
    window.requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(next.cursor, next.cursor);
    });
  };

  const excludeIds = eventTaggedUsers.map((u) => u.id);

  return (
    <div className="relative">
      {activeMention && token ? (
        <StoryMentionAutocomplete
          token={token}
          query={activeMention.query}
          excludeIds={excludeIds}
          currentTagCount={eventTaggedUsers.length}
          maxTags={maxMentions}
          onSelect={handleMentionSelect}
          className="absolute left-0 right-0 bottom-full z-20 mb-2"
        />
      ) : null}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onSelect={handleSelect}
        onKeyUp={handleSelect}
        onClick={handleSelect}
        className={className}
        {...textareaProps}
      />
    </div>
  );
}
