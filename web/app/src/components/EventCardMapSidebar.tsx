import { useTranslation } from 'react-i18next';
import type { FeedPost } from '../types';
import { EventCardMapCompact } from './EventCardMapCompact';
import { EventDevSponsoButton } from './EventDevSponsoButton';

export interface EventCardMapSidebarProps {
  post: FeedPost;
  onOpen: (post: FeedPost) => void;
  onPostChange?: (patch: Partial<FeedPost>) => void;
}

/** Carte événement compacte pour le panneau latéral carte — clic = zoom + surbrillance pin. */
export function EventCardMapSidebar({ post, onOpen, onPostChange }: EventCardMapSidebarProps) {
  const { t } = useTranslation();
  const locateLabel = t('map.eventsBrowseViewOnMap', { defaultValue: 'Voir sur la carte' });
  const title = post.content.trim() || t('feed.eventTypeAutre');
  const location = post.eventLocation?.trim() ?? '';
  const summaryParts = [title];
  if (location) summaryParts.push(location);
  const cardAria = t('map.eventSidebarCardAria', {
    summary: summaryParts.join(', '),
    defaultValue: `${locateLabel} — ${summaryParts.join(', ')}`,
  });

  return (
    <div className="group relative text-left overflow-hidden rounded-xl border border-purple-500/35 bg-[#12121a] shadow-[0_0_20px_rgba(168,85,247,0.1)] hover:border-purple-400/50 hover:shadow-[0_0_24px_rgba(168,85,247,0.18)] transition-all events-carousel-card snap-start snap-always">
      <EventDevSponsoButton post={post} className="absolute top-1.5 left-1.5 z-10" />
      <EventCardMapCompact
        post={post}
        onPostChange={onPostChange}
        density="sidebar"
        onActivate={() => onOpen(post)}
        activateAriaLabel={cardAria}
      />
    </div>
  );
}
