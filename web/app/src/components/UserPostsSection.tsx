import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { getFeedPostImageUrls, feedPostHasImages } from '../lib/feedPostMedia';
import { FeedPostDetailModal } from './FeedPostDetailModal';
import type { FeedPost } from '../types';

interface UserPostsSectionProps {
  userId: string;
  hideSectionTitle?: boolean;
  onOpenPost?: (post: FeedPost) => void;
  onOpenProfile?: (userId: string) => void;
}

type GridCell = {
  post: FeedPost;
  imageIndex: number;
  url: string;
};

function PostEmptyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z"
      />
    </svg>
  );
}

export function UserPostsSection({
  userId,
  hideSectionTitle,
  onOpenPost,
  onOpenProfile,
}: UserPostsSectionProps) {
  const { token } = useAuth();
  const { t } = useTranslation();

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailPost, setDetailPost] = useState<FeedPost | null>(null);
  const [detailImageIndex, setDetailImageIndex] = useState(0);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setPosts([]);
      return;
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError(null);
    setPosts([]);

    api
      .getFeedPosts(token, { authorId: userId, limit: 50 })
      .then((feedData) => {
        if (ctrl.signal.aborted) return;
        const regular = feedData.posts
          .filter((p) => !p.isEvent)
          .sort((a, b) => b.createdAt - a.createdAt);
        setPosts(regular);
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });

    return () => {
      ctrl.abort();
    };
  }, [userId, token]);

  const gridCells = useMemo(() => {
    const cells: GridCell[] = [];
    for (const post of posts) {
      if (!feedPostHasImages(post)) continue;
      const urls = getFeedPostImageUrls(post);
      cells.push({ post, imageIndex: 0, url: urls[0]! });
    }
    return cells;
  }, [posts]);

  const openDetail = (post: FeedPost, imageIndex: number) => {
    if (onOpenPost) {
      onOpenPost(post);
      return;
    }
    setDetailImageIndex(imageIndex);
    setDetailPost(post);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-1.5">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="aspect-square rounded-lg bg-[#1e1e2f] animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
        <PostEmptyIcon className="w-10 h-10 text-red-400/60" />
        <p className="text-sm text-red-400/80">{error}</p>
      </div>
    );
  }

  if (gridCells.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
        <PostEmptyIcon className="w-10 h-10 text-purple-500/30" />
        <p className="text-sm text-gray-500">{t('profile.noPhotoPosts')}</p>
      </div>
    );
  }

  return (
    <>
      <section className="flex flex-col gap-2">
        {!hideSectionTitle ? (
          <h3 className="text-[11px] font-bold text-purple-300 uppercase tracking-wide px-0.5">
            {t('profile.sectionPhotos')}
          </h3>
        ) : null}
        <div className="grid grid-cols-3 gap-1.5 w-full">
          {gridCells.map(({ post, url }) => {
            const urls = getFeedPostImageUrls(post);
            const multi = urls.length > 1;
            const label =
              post.content?.trim().slice(0, 80) ||
              t('profile.publicationDetail', { defaultValue: 'Publication' });
            return (
              <button
                key={post.id}
                type="button"
                onClick={() => openDetail(post, 0)}
                className="relative aspect-square w-full min-h-[44px] overflow-hidden rounded-lg bg-[#1e1e2f] ring-1 ring-[#2a2a36] hover:ring-purple-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 transition"
                aria-label={label}
              >
                <img src={url} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                {multi ? (
                  <span
                    className="absolute top-1.5 right-1.5 flex items-center justify-center min-w-[22px] h-[22px] px-1 rounded-md bg-black/65 text-[10px] font-bold text-white border border-white/15"
                    aria-hidden
                  >
                    {urls.length}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </section>

      {!onOpenPost ? (
        <FeedPostDetailModal
          open={detailPost != null}
          post={detailPost}
          initialImageIndex={detailImageIndex}
          onClose={() => setDetailPost(null)}
          onOpenProfile={onOpenProfile}
          onUpdated={(updated) => {
            setDetailPost(updated);
            setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
          }}
          onDeleted={(postId, deletedIds) => {
            const gone = new Set(deletedIds.length ? deletedIds : [postId]);
            setPosts((prev) => prev.filter((p) => !gone.has(p.id)));
            setDetailPost(null);
          }}
        />
      ) : null}
    </>
  );
}
