import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { buildFeedEventContent, CreateFeedEventModal, type FeedEventDraft } from './CreateFeedEventModal';
import { ConfirmModal } from './ConfirmModal';
import { ReportContentModal } from './ReportContentModal';
import { dispatchMapEventsRefresh } from '../lib/mapUiEvents';
import { getEventDateEntries, splitFeedEventContent } from '../lib/feedEvents';
import { getFeedPostImageUrls } from '../lib/feedPostMedia';
import { isFeedPostOwner } from '../lib/feedPostOwner';
import { validateStoryLinkUrl } from '../lib/storyLink';
import type { FeedPost } from '../types';

function mediaPayloadFromPost(post: FeedPost): {
  imageUrl?: string;
  imageUrls?: string[];
  videoUrl?: string;
} {
  const urls = getFeedPostImageUrls(post);
  return {
    ...(urls.length > 1 ? { imageUrls: urls } : urls[0] ? { imageUrl: urls[0] } : {}),
    ...(post.videoUrl ? { videoUrl: post.videoUrl } : {}),
  };
}

function KebabIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <circle cx="12" cy="5" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="12" cy="19" r="1.7" />
    </svg>
  );
}

function draftFromEventPost(post: FeedPost): FeedEventDraft {
  const { title, description } = splitFeedEventContent(post.content);
  return {
    title,
    description,
    eventType: post.eventType ?? 'autre',
    confirmedEventDates: getEventDateEntries(post).map((e) => ({
      start: e.start,
      end: e.end,
    })),
    eventLocation: post.eventLocation ?? '',
    saveEventLocation: true,
    eventTaggedUsers: post.eventTaggedUsers ?? [],
    imageUrl: post.imageUrl ?? '',
    eventLinkUrl: post.eventLinkUrl ?? '',
  };
}

export function FeedPostOwnerActions({
  post,
  onUpdated,
  onDeleted,
  compact = false,
}: {
  post: FeedPost;
  onUpdated?: (post: FeedPost) => void;
  onDeleted?: (postId: string, deletedIds: string[]) => void;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const { user, token } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [draft, setDraft] = useState(post.content);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwner = isFeedPostOwner(user, post);
  const isReshare = Boolean(post.resharedFromId);
  const isEvent = Boolean(post.isEvent) && !isReshare;

  useEffect(() => {
    setDraft(post.content);
    setError(null);
  }, [post.id, post.content]);

  if (!token) return null;

  const closeAll = () => {
    setMenuOpen(false);
    setEditOpen(false);
    setConfirmDelete(false);
    setError(null);
    setDraft(post.content);
  };

  const savePostOrReshare = async () => {
    if (!token || saving) return;
    setSaving(true);
    setError(null);
    try {
      const r = await api.updateFeedPost(token, post.id, {
        content: draft,
        ...(isReshare ? {} : mediaPayloadFromPost(post)),
      });
      onUpdated?.(r.post);
      setEditOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('feed.savePostError', { defaultValue: 'Enregistrement impossible.' }));
    } finally {
      setSaving(false);
    }
  };

  const saveEvent = async (eventDraft: FeedEventDraft) => {
    if (!token || saving) return;
    setSaving(true);
    setError(null);
    try {
      const eventTypeLabel =
        eventDraft.eventType === 'dance'
          ? t('feed.eventTypeDance')
          : eventDraft.eventType === 'chant'
            ? t('feed.eventTypeChant')
            : t('feed.eventTypeAutre');
      const content = buildFeedEventContent(eventDraft.title, eventDraft.description, eventTypeLabel);
      const eventDatesIso = eventDraft.confirmedEventDates.map((e) => new Date(e.start).toISOString());
      const body: Parameters<typeof api.updateFeedPost>[2] = {
        content,
        isEvent: true,
        eventDates: eventDatesIso,
        eventDate: eventDatesIso[0],
        eventLocation: eventDraft.eventLocation.trim(),
        eventType: eventDraft.eventType,
      };
      const img = eventDraft.imageUrl.trim();
      if (img) body.imageUrl = img;
      const linkRaw = eventDraft.eventLinkUrl.trim();
      if (linkRaw) {
        const validated = validateStoryLinkUrl(linkRaw);
        if (!validated.ok) {
          setError(validated.error);
          setSaving(false);
          return;
        }
        body.eventLinkUrl = validated.url;
      }
      const endTimesIso = eventDraft.confirmedEventDates.map((e) =>
        e.end ? new Date(e.end).toISOString() : null
      );
      if (endTimesIso.some(Boolean)) body.eventEndTimes = endTimesIso;
      if (eventDraft.eventTaggedUsers.length > 0) {
        body.eventTaggedUserIds = eventDraft.eventTaggedUsers.map((u) => u.id);
      }
      const r = await api.updateFeedPost(token, post.id, body);
      onUpdated?.(r.post);
      dispatchMapEventsRefresh();
      setEditOpen(false);
    } catch (e) {
      setEditOpen(false);
      setError(e instanceof Error ? e.message : t('feed.savePostError', { defaultValue: 'Enregistrement impossible.' }));
    } finally {
      setSaving(false);
    }
  };

  const removePost = async () => {
    if (!token || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      const r = await api.deleteFeedPost(token, post.id);
      onDeleted?.(post.id, r.deletedIds ?? [post.id]);
      if (isEvent) dispatchMapEventsRefresh();
      closeAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('feed.deletePostError', { defaultValue: 'Suppression impossible.' }));
    } finally {
      setDeleting(false);
    }
  };

  const deleteTitle = isReshare
    ? t('feed.deleteReshareTitle', { defaultValue: 'Supprimer ce repartage ?' })
    : isEvent
      ? t('feed.deleteEventTitle', { defaultValue: 'Supprimer cet événement ?' })
      : t('feed.deletePostTitle', { defaultValue: 'Supprimer cette publication ?' });
  const deleteBody = isReshare
    ? t('feed.deleteReshareBody', {
        defaultValue: "Votre republication sera retirée. La publication d'origine reste visible.",
      })
    : isEvent
      ? t('feed.deleteEventBody', {
          defaultValue:
            "L'événement disparaîtra du fil, des profils et de la carte. Les republications seront aussi retirées.",
        })
      : t('feed.deletePostBody', {
          defaultValue: 'Elle disparaîtra du fil et des profils. Cette action est définitive.',
        });

  const btnClass =
    'w-11 h-11 inline-flex items-center justify-center rounded-lg text-purple-200 hover:bg-purple-950/40';

  const menu = menuOpen
    ? createPortal(
        <div
          className="fixed inset-0 z-[115] flex items-center justify-center p-5 bg-black/55 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={t('feed.ownerMenu', { defaultValue: 'Actions de la publication' })}
          onClick={() => setMenuOpen(false)}
        >
          <div
            className="relative z-10 w-full max-w-[min(100%,22rem)] mx-auto rounded-2xl border border-[#2d2d3d] bg-[#12121a] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-400">
              {t('feed.ownerMenu', { defaultValue: 'Actions de la publication' })}
            </p>
            {isOwner ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setDraft(post.content);
                    setEditOpen(true);
                  }}
                  className="w-full min-h-[44px] px-4 text-left text-sm font-semibold text-white hover:bg-white/5"
                >
                  {t('feed.editPost', { defaultValue: 'Modifier' })}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setConfirmDelete(true);
                  }}
                  className="w-full min-h-[44px] px-4 text-left text-sm font-semibold text-red-400 hover:bg-red-950/30"
                >
                  {t('feed.deletePost', { defaultValue: 'Supprimer' })}
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setReportOpen(true);
              }}
              className="w-full min-h-[44px] px-4 text-left text-sm font-semibold text-red-400 hover:bg-red-950/30"
            >
              {t('feed.reportPost', { defaultValue: 'Signaler' })}
            </button>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="w-full min-h-[44px] px-4 text-left text-sm font-semibold text-gray-400 hover:bg-white/5 border-t border-[#1e1e2f]"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>,
        document.body
      )
    : null;

  const editModal =
    editOpen && !isEvent
      ? createPortal(
          <div
            className="fixed inset-0 z-[116] flex items-center justify-center p-5 bg-black/60 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-feed-post-title"
            onClick={() => {
              if (!saving) setEditOpen(false);
            }}
          >
            <div
              className="relative z-10 w-full max-w-[min(100%,22rem)] mx-auto max-h-[min(80dvh,36rem)] flex flex-col rounded-2xl border border-[#2d2d3d] bg-[#12121a] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 py-3 border-b border-[#1e1e2f]">
                <h2 id="edit-feed-post-title" className="text-base font-bold text-white">
                  {isReshare
                    ? t('feed.editReshareTitle', { defaultValue: 'Modifier le repartage' })
                    : t('feed.editPostTitle', { defaultValue: 'Modifier la publication' })}
                </h2>
              </div>
              <div className="p-4 space-y-3">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  maxLength={2000}
                  rows={5}
                  placeholder={
                    isReshare
                      ? t('feed.editResharePlaceholder', {
                          defaultValue: 'Ajouter un commentaire (optionnel)',
                        })
                      : t('feed.placeholder')
                  }
                  className="w-full min-h-[8rem] rounded-xl border border-[#2a2a3d] bg-[#0b0b0f] px-3 py-2.5 text-sm text-white placeholder:text-gray-600 outline-none focus:border-purple-500/50"
                />
                {error ? (
                  <p className="text-xs text-red-400" role="alert">
                    {error}
                  </p>
                ) : null}
              </div>
              <div className="flex gap-2 p-4 border-t border-[#1e1e2f] pb-[max(1rem,env(safe-area-inset-bottom))]">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setEditOpen(false)}
                  className="flex-1 min-h-[44px] rounded-xl border border-[#2d2d3d] text-sm font-semibold text-gray-300"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void savePostOrReshare()}
                  className="flex-1 min-h-[44px] rounded-xl bg-purple-600 text-sm font-bold text-white disabled:opacity-50"
                >
                  {saving
                    ? t('feed.savingPost', { defaultValue: 'Enregistrement…' })
                    : t('feed.savePost', { defaultValue: 'Enregistrer' })}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div
      className="shrink-0"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <button
        type="button"
        className={btnClass}
        aria-label={t('feed.ownerMenu', { defaultValue: 'Actions de la publication' })}
        onClick={() => setMenuOpen(true)}
      >
        <KebabIcon className="w-4 h-4" />
      </button>
      {menu}
      {editModal}
      {isEvent ? (
        <CreateFeedEventModal
          open={editOpen}
          mode="edit"
          onClose={() => {
            if (!saving) setEditOpen(false);
          }}
          onConfirm={(eventDraft) => {
            void saveEvent(eventDraft);
          }}
          initialDraft={draftFromEventPost(post)}
          token={token}
          profileCity={user?.city}
        />
      ) : null}
      <ConfirmModal
        open={confirmDelete}
        title={deleteTitle}
        description={deleteBody}
        confirmLabel={t('feed.deletePost', { defaultValue: 'Supprimer' })}
        loading={deleting}
        error={error}
        onCancel={() => {
          if (!deleting) {
            setConfirmDelete(false);
            setError(null);
          }
        }}
        onConfirm={() => {
          void removePost();
        }}
      />
      {reportOpen ? (
        <ReportContentModal
          context={{
            ...(isOwner
              ? {}
              : {
                  targetUserId: post.userId || post.author.id,
                  targetUsername: post.author.username,
                }),
            roomType: 'feed',
            roomId: post.id,
          }}
          onClose={() => setReportOpen(false)}
          overlayZClass="z-[130]"
        />
      ) : null}
      <ConfirmModal
        open={Boolean(error) && !confirmDelete && !editOpen}
        alertOnly
        title={t('feed.savePostError', { defaultValue: 'Enregistrement impossible.' })}
        description={error ?? ''}
        confirmLabel={t('common.close')}
        onCancel={() => setError(null)}
        onConfirm={() => setError(null)}
      />
    </div>
  );
}
