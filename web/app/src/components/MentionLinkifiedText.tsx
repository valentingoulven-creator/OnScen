import type { ReactNode } from 'react';
import { splitTextWithLinks } from '../lib/linkifyText';
import { syncOverlayMentionRefs, type StoryTextMentionRef } from '../lib/storyTextMention';
import type { StoryTaggedUser } from '../types';

const LINK_CLASS =
  'text-sky-300 hover:text-sky-200 underline decoration-sky-400/40 underline-offset-2 break-all';

type MentionLinkifiedTextProps = {
  text: string;
  className?: string;
  as?: 'p' | 'div' | 'span';
  mentionUsers?: StoryTaggedUser[] | StoryTextMentionRef[];
  onOpenProfile?: (userId: string) => void;
};

function toRefs(users: StoryTaggedUser[] | StoryTextMentionRef[] | undefined): StoryTextMentionRef[] {
  if (!users?.length) return [];
  return users.map((u) => ({ id: u.id, username: u.username }));
}

function renderPlainWithLinks(chunk: string, keyPrefix: string): ReactNode[] {
  const segments = splitTextWithLinks(chunk);
  return segments.map((seg, i) => {
    const key = `${keyPrefix}-${i}`;
    if (seg.type === 'text') {
      return <span key={key}>{seg.value}</span>;
    }
    if (seg.internal?.kind === 'profile' && seg.href.startsWith('#')) {
      return (
        <a key={key} href={seg.href} className={LINK_CLASS}>
          {seg.display}
        </a>
      );
    }
    return (
      <a
        key={key}
        href={seg.href}
        className={LINK_CLASS}
        target="_blank"
        rel="noopener noreferrer"
      >
        {seg.display}
      </a>
    );
  });
}

/** Texte avec @mentions cliquables (profil) + URLs linkifiées. */
export function MentionLinkifiedText({
  text,
  className,
  as: Tag = 'div',
  mentionUsers,
  onOpenProfile,
}: MentionLinkifiedTextProps) {
  const synced = syncOverlayMentionRefs(text, toRefs(mentionUsers));
  const known = new Map(synced.map((r) => [r.username.toLowerCase(), r]));

  if (!known.size) {
    const segments = splitTextWithLinks(text);
    const hasLinks = segments.some((s) => s.type === 'link');
    if (!hasLinks) {
      return <Tag className={className}>{text}</Tag>;
    }
    return <Tag className={className}>{renderPlainWithLinks(text, 'plain')}</Tag>;
  }

  const re = /(^|[\s])(@\w+(?:\.\w+)*)/g;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let partIndex = 0;

  while ((match = re.exec(text)) !== null) {
    const prefix = match[1];
    const mentionToken = match[2];
    const username = mentionToken.slice(1);
    const start = match.index + prefix.length;

    if (start > lastIndex) {
      parts.push(...renderPlainWithLinks(text.slice(lastIndex, start), `t${partIndex++}`));
    }

    const ref = known.get(username.toLowerCase());
    if (ref && onOpenProfile) {
      parts.push(
        <button
          key={`m${start}`}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenProfile(ref.id);
          }}
          className="font-semibold text-purple-300 hover:text-purple-200 hover:underline underline-offset-2 touch-manipulation"
        >
          {mentionToken}
        </button>
      );
    } else {
      parts.push(<span key={`m${start}`}>{mentionToken}</span>);
    }
    lastIndex = start + mentionToken.length;
  }

  if (lastIndex < text.length) {
    parts.push(...renderPlainWithLinks(text.slice(lastIndex), `t${partIndex}`));
  }

  return <Tag className={className}>{parts.length ? parts : text}</Tag>;
}
