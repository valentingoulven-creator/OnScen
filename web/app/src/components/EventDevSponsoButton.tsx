import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FeedPost } from '../types';
import { useDevMapSidebarEventSponso } from '../hooks/useDevMapSidebarEventSponso';
import { EventDevSponsoModal } from './EventDevSponsoModal';

export interface EventDevSponsoButtonProps {
  post: FeedPost;
  className?: string;
}

/** Bouton Dev pour promouvoir un événement dans le carrousel Sponso (sidebar carte). */
export function EventDevSponsoButton({ post, className = 'absolute top-2 left-2 z-10' }: EventDevSponsoButtonProps) {
  const { t } = useTranslation();
  const { isDev, isSponsored } = useDevMapSidebarEventSponso();
  const [modalOpen, setModalOpen] = useState(false);

  if (!isDev) return null;

  const sponsored = isSponsored(post.id);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setModalOpen(true);
        }}
        className={`${className} min-h-[44px] px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border backdrop-blur-sm transition-colors ${
          sponsored
            ? 'bg-purple-600/90 text-white border-purple-300/50 shadow-[0_0_16px_rgba(168,85,247,0.35)]'
            : 'bg-black/55 text-purple-200 border-purple-500/35 hover:bg-purple-950/80 hover:text-purple-100'
        }`}
        aria-label={sponsored ? t('feed.eventSponsoDevEdit') : t('feed.eventSponsoDevAdd')}
        title={sponsored ? t('feed.eventSponsoDevEdit') : t('feed.eventSponsoDevAdd')}
      >
        {sponsored ? t('feed.eventSponsoDevActive') : t('feed.eventSponsoDev')}
      </button>
      <EventDevSponsoModal open={modalOpen} onClose={() => setModalOpen(false)} post={post} />
    </>
  );
}
