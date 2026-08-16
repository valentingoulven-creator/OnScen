import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { api } from '../lib/api';
import { buildFeedPostSharePayload, getFeedPostShareUrl } from '../lib/feedPostShare';
import { ShareLinkMenu } from './ShareLinkMenu';
import { ShareToUserSheet } from './ShareToUserSheet';
import { ConfirmModal } from './ConfirmModal';
import { notifySavedEventChanged } from '../lib/savedEventSync';
import type { CommentAlign, FeedPost, FeedPostComment } from '../types';

function HeartIcon({ filled, className }: { filled?: boolean; className?: string }) {
  return filled ? (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function CommentIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98" />
    </svg>
  );
}

function BookmarkIcon({ filled, className }: { filled?: boolean; className?: string }) {
  return filled ? (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function commentRowClass(align?: CommentAlign): string {
  if (align === 'right') return 'flex-row-reverse';
  if (align === 'center') return 'justify-center';
  return '';
}

function commentBubbleClass(align?: CommentAlign): string {
  if (align === 'right') return 'text-right';
  if (align === 'center') return 'text-center';
  if (align === 'full') return 'w-full text-justify';
  return 'text-left';
}

export interface FeedPostInteractionsProps {
  post: FeedPost;
  token: string | null;
  onPostChange: (patch: Partial<FeedPost>) => void;
  onToast?: (message: string) => void;
  className?: string;
  /** Barre compacte pour la ligne profil (sans encadré). */
  inlineToolbar?: boolean;
  /** Remplace l’ouverture inline des commentaires (ex. aperçu carte → modal détail). */
  onCommentClick?: () => void;
  children?: (parts: { toolbar: ReactNode; comments: ReactNode }) => ReactNode;
}

export function FeedPostInteractions({
  post,
  token,
  onPostChange,
  onToast,
  className = '',
  inlineToolbar = false,
  onCommentClick,
  children,
}: FeedPostInteractionsProps) {
  const { t } = useTranslation();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [fullComments, setFullComments] = useState<FeedPostComment[] | undefined>();
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentPosting, setCommentPosting] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareToUserOpen, setShareToUserOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [confirmRemoveFavorite, setConfirmRemoveFavorite] = useState(false);

  useEffect(() => {
    setCommentsOpen(false);
    setCommentDraft('');
    setFullComments(undefined);
    setCommentsLoading(false);
    setCommentPosting(false);
    setShareOpen(false);
    setShareToUserOpen(false);
    setConfirmRemoveFavorite(false);
  }, [post.id]);

  const sharePayload = useMemo(
    () =>
      buildFeedPostSharePayload(post, i18n.language, {
        feedPostTitle: t('share.feedPostTitle'),
        eventTitle: t('share.eventTitle'),
        eventDate: t('share.eventDate'),
        eventLocation: t('share.eventLocation'),
      }),
    [post, t]
  );

  useEffect(() => {
    if (!shareOpen) {
      setShareUrl('');
      return;
    }
    let cancelled = false;
    void getFeedPostShareUrl(post.id).then((url) => {
      if (!cancelled) setShareUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [shareOpen, post.id]);

  const toast = useCallback(
    (msg: string) => {
      onToast?.(msg);
    },
    [onToast]
  );

  const handleLike = useCallback(async () => {
    if (!token) return;
    const wasLiked = post.likedByMe;
    onPostChange({
      likedByMe: !wasLiked,
      likeCount: wasLiked ? Math.max(0, post.likeCount - 1) : post.likeCount + 1,
    });
    try {
      if (wasLiked) {
        await api.unlikeFeedPost(token, post.id);
      } else {
        await api.likeFeedPost(token, post.id);
      }
    } catch {
      onPostChange({ likedByMe: wasLiked, likeCount: post.likeCount });
      toast(t('feed.likeError', { defaultValue: 'Impossible de liker' }));
    }
  }, [token, post, onPostChange, toast, t]);

  const performToggleFavorite = useCallback(
    async (wasFav: boolean) => {
      if (!token) return;
      const nextFav = !wasFav;
      onPostChange({ favoriteByMe: nextFav });
      if (post.isEvent) {
        notifySavedEventChanged(post.id, nextFav, { ...post, favoriteByMe: nextFav });
      }
      try {
        if (wasFav) {
          await api.removeFeedPostFavorite(token, post.id);
          toast(
            post.isEvent
              ? t('feed.eventUnfollowed', { defaultValue: 'Retiré des événements suivis' })
              : t('feed.removedFromFavorites', { defaultValue: 'Retiré des favoris' })
          );
        } else {
          await api.addFeedPostFavorite(token, post.id);
          toast(
            post.isEvent
              ? t('feed.eventFollowed', { defaultValue: 'Événement suivi' })
              : t('feed.addedToFavorites', { defaultValue: 'Ajouté aux favoris' })
          );
        }
      } catch {
        onPostChange({ favoriteByMe: wasFav });
        if (post.isEvent) {
          notifySavedEventChanged(post.id, wasFav, { ...post, favoriteByMe: wasFav });
        }
        toast(t('feed.favoriteError', { defaultValue: 'Erreur — réessayez' }));
      }
    },
    [token, post, onPostChange, toast, t]
  );

  const handleToggleFavorite = useCallback(() => {
    if (!token) return;
    if (post.favoriteByMe) {
      setConfirmRemoveFavorite(true);
      return;
    }
    void performToggleFavorite(false);
  }, [token, post.favoriteByMe, performToggleFavorite]);

  const handleToggleComments = useCallback(async () => {
    if (!token) return;
    const nextOpen = !commentsOpen;
    setCommentsOpen(nextOpen);
    if (nextOpen && !fullComments) {
      setCommentsLoading(true);
      try {
        const r = await api.getFeedPostComments(token, post.id);
        setFullComments(r.comments);
      } catch {
        /* ignore */
      } finally {
        setCommentsLoading(false);
      }
    }
  }, [token, commentsOpen, fullComments, post.id]);

  const handlePostComment = useCallback(async () => {
    if (!token || commentPosting) return;
    const content = commentDraft.trim();
    if (!content) return;
    setCommentPosting(true);
    try {
      const r = await api.postFeedComment(token, post.id, content);
      setFullComments((prev) => [...(prev ?? post.recentComments ?? []), r.comment]);
      onPostChange({ commentCount: r.commentCount });
      setCommentDraft('');
    } catch (e) {
      toast(e instanceof Error ? e.message : t('feed.commentError', { defaultValue: 'Impossible de commenter' }));
    } finally {
      setCommentPosting(false);
    }
  }, [token, commentPosting, commentDraft, post, onPostChange, toast, t]);

  const displayedComments = fullComments ?? post.recentComments ?? [];

  const btnClass = inlineToolbar
    ? 'flex items-center justify-center gap-0.5 min-h-[36px] min-w-[36px] px-1 rounded-lg transition text-[10px] font-medium'
    : 'flex items-center justify-center gap-1 min-h-[44px] min-w-[44px] px-2 py-2 rounded-lg transition text-xs font-medium';

  const iconClass = inlineToolbar ? 'w-3.5 h-3.5 shrink-0' : 'w-4 h-4 shrink-0';

  const toolbar = (
    <div className={`flex items-center gap-0.5 ${inlineToolbar ? '' : 'px-1 py-1'}`}>
      <button
        type="button"
        onClick={() => void handleLike()}
        disabled={!token}
        className={`${btnClass} ${
          post.likedByMe
            ? 'text-red-400 bg-red-900/15 hover:bg-red-900/25'
            : 'text-gray-500 hover:text-red-300 hover:bg-red-900/10'
        } disabled:opacity-40`}
        title={post.likedByMe ? t('feed.unlike') : t('feed.like')}
        aria-label={post.likedByMe ? t('feed.unlike') : t('feed.like')}
      >
        <HeartIcon filled={post.likedByMe} className={iconClass} />
        {post.likeCount > 0 && <span>{post.likeCount}</span>}
      </button>

      <button
        type="button"
        onClick={() => (onCommentClick ? onCommentClick() : void handleToggleComments())}
        disabled={!token && !onCommentClick}
        className={`${btnClass} ${
          !onCommentClick && commentsOpen
            ? 'text-purple-400 bg-purple-900/15 hover:bg-purple-900/25'
            : post.commentCount > 0
              ? 'text-purple-400/90 bg-purple-900/10 hover:bg-purple-900/15'
              : 'text-gray-500 hover:text-purple-300 hover:bg-purple-900/10'
        } disabled:opacity-40`}
        title={t('feed.comment')}
        aria-label={t('feed.comment')}
      >
        <CommentIcon className={iconClass} />
        {post.commentCount > 0 && <span>{post.commentCount}</span>}
      </button>

      <button
        type="button"
        onClick={() => setShareOpen(true)}
        disabled={!token}
        className={`${btnClass} text-gray-500 hover:text-blue-300 hover:bg-blue-900/10 disabled:opacity-40`}
        title={t('common.share')}
        aria-label={t('common.share')}
      >
        <ShareIcon className={iconClass} />
      </button>

      <button
        type="button"
        onClick={handleToggleFavorite}
        disabled={!token}
        className={`${btnClass} ${
          post.favoriteByMe
            ? 'text-amber-400 bg-amber-900/15 hover:bg-amber-900/25'
            : 'text-gray-500 hover:text-amber-300 hover:bg-amber-900/10'
        } disabled:opacity-40`}
        title={
          post.isEvent
            ? post.favoriteByMe
              ? t('feed.unfollowEvent', { defaultValue: 'Ne plus suivre' })
              : t('feed.followEvent', { defaultValue: "Suivre l'événement" })
            : post.favoriteByMe
              ? t('feed.removeFavorite')
              : t('feed.addFavorite')
        }
        aria-label={
          post.isEvent
            ? post.favoriteByMe
              ? t('feed.unfollowEvent', { defaultValue: 'Ne plus suivre' })
              : t('feed.followEvent', { defaultValue: "Suivre l'événement" })
            : post.favoriteByMe
              ? t('feed.removeFavorite')
              : t('feed.addFavorite')
        }
      >
        <BookmarkIcon filled={post.favoriteByMe} className={iconClass} />
      </button>
    </div>
  );

  const commentsSection =
    commentsOpen ? (
      <div className={`space-y-2 ${inlineToolbar ? 'rounded-xl border border-[#1e1e2f] bg-[#0e0e14] p-3' : 'p-3'}`}>
        {commentsLoading && (
          <p className="text-xs text-gray-600 text-center">{t('feed.commentsLoading')}</p>
        )}
        {!commentsLoading && displayedComments.length === 0 && (
          <p className="text-xs text-gray-600 text-center">{t('feed.commentsEmpty')}</p>
        )}
        <div className="post-comments-scroll max-h-[220px] space-y-2 overflow-y-auto overscroll-contain">
          {displayedComments.map((c) => (
            <div key={c.id} className={`flex gap-2 ${commentRowClass(c.textAlign)}`}>
              {c.textAlign !== 'center' && (
                <img
                  src={c.avatarUrl || '/icon.svg'}
                  alt=""
                  className="w-6 h-6 rounded-full object-cover bg-[#1e1e2f] shrink-0 mt-0.5"
                  loading="lazy"
                  decoding="async"
                />
              )}
              <div
                className={`min-w-0 bg-[#0e0e18] rounded-xl px-3 py-2 ${commentBubbleClass(c.textAlign)} ${c.textAlign === 'full' ? 'flex-1' : 'max-w-[85%]'}`}
              >
                <p className="text-[11px] font-semibold text-white truncate">{c.username}</p>
                <p className="text-xs text-gray-300 break-words">{c.content}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <textarea
            value={commentDraft}
            onChange={(e) => setCommentDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handlePostComment();
              }
            }}
            placeholder={t('feed.commentPlaceholder')}
            rows={1}
            maxLength={500}
            className="flex-1 rounded-xl bg-[#0b0b0f] border border-[#2a2a3d] px-3 py-2.5 text-xs text-white placeholder:text-gray-600 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/50 min-h-[44px]"
          />
          <button
            type="button"
            disabled={!commentDraft.trim() || commentPosting}
            onClick={() => void handlePostComment()}
            className="px-3 min-h-[44px] rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white disabled:opacity-40 transition shrink-0"
          >
            {commentPosting ? '…' : t('feed.commentSend', { defaultValue: 'Envoyer' })}
          </button>
        </div>
      </div>
    ) : null;

  const modals = (
    <>
      {shareOpen && shareUrl && !shareToUserOpen && (
        <ShareLinkMenu
          open
          onClose={() => setShareOpen(false)}
          url={shareUrl}
          title={sharePayload.title}
          text={sharePayload.text}
          onToast={toast}
          onSendToUser={token ? () => setShareToUserOpen(true) : undefined}
          overlayZClass="z-[120]"
        />
      )}

      {shareOpen && shareUrl && shareToUserOpen && token ? (
        <ShareToUserSheet
          open
          onBack={() => setShareToUserOpen(false)}
          onClose={() => {
            setShareToUserOpen(false);
            setShareOpen(false);
          }}
          token={token}
          shareUrl={shareUrl}
          shareText={sharePayload.text}
          onToast={toast}
          overlayZClass="z-[120]"
        />
      ) : null}

      <ConfirmModal
        open={confirmRemoveFavorite}
        title={
          post.isEvent
            ? t('feed.unfollowEventConfirmTitle', { defaultValue: 'Ne plus suivre cet événement ?' })
            : t('feed.removeFavoriteConfirmTitle', { defaultValue: 'Retirer cette publication de vos favoris ?' })
        }
        description={
          post.isEvent
            ? t('feed.unfollowEventConfirmBody', {
                defaultValue: 'Il disparaîtra de « Événement suivi » sur la carte et le globe.',
              })
            : t('feed.removeFavoriteConfirmBody', {
                defaultValue: 'Elle ne figurera plus dans votre liste de favoris.',
              })
        }
        confirmLabel={t('feed.removeFavoriteConfirmAction', { defaultValue: 'Retirer' })}
        onCancel={() => setConfirmRemoveFavorite(false)}
        onConfirm={() => {
          setConfirmRemoveFavorite(false);
          void performToggleFavorite(true);
        }}
      />
    </>
  );

  if (children) {
    return (
      <>
        {children({ toolbar, comments: commentsSection })}
        {modals}
      </>
    );
  }

  return (
    <>
      <div className={`rounded-xl border border-[#1e1e2f] bg-[#0e0e14] ${className}`}>
        <div className="border-b border-[#1a1a28]">{toolbar}</div>
        {commentsSection}
      </div>
      {modals}
    </>
  );
}
