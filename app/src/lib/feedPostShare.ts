import type { FeedPost } from '../types';
import { getEventDates } from './feedEvents';
import { resolveShareOrigin } from './shareLink';

export function getFeedPostPath(postId: string): string {
  return `/#/post/${encodeURIComponent(postId)}`;
}

export async function getFeedPostShareUrl(postId: string): Promise<string> {
  const base = await resolveShareOrigin();
  return `${base}${getFeedPostPath(postId)}`;
}

function localeTag(lang: string): string {
  return lang.startsWith('en') ? 'en-US' : 'fr-FR';
}

function formatShareEventDate(iso: string, lang: string): string {
  try {
    return new Date(iso).toLocaleDateString(localeTag(lang), {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export type FeedPostSharePayload = {
  title: string;
  text: string;
};

/** Titre + texte pour partage externe (publication ou événement). */
export function buildFeedPostSharePayload(
  post: Pick<FeedPost, 'content' | 'isEvent' | 'eventDate' | 'eventDates' | 'eventLocation'>,
  lang: string,
  labels: {
    feedPostTitle: string;
    eventTitle: string;
    eventDate: string;
    eventLocation: string;
  }
): FeedPostSharePayload {
  const excerpt = post.content.trim().slice(0, 120);
  const defaultTitle = post.isEvent ? labels.eventTitle : labels.feedPostTitle;

  if (!post.isEvent) {
    return {
      title: excerpt.slice(0, 80) || defaultTitle,
      text: excerpt || defaultTitle,
    };
  }

  const parts: string[] = [];
  if (excerpt) parts.push(excerpt);
  for (const iso of getEventDates(post)) {
    parts.push(labels.eventDate.replace('{{date}}', formatShareEventDate(iso, lang)));
  }
  if (post.eventLocation?.trim()) {
    parts.push(labels.eventLocation.replace('{{location}}', post.eventLocation.trim()));
  }

  const text = parts.join('\n') || defaultTitle;
  const title = excerpt.slice(0, 80) || defaultTitle;

  return { title, text };
}
