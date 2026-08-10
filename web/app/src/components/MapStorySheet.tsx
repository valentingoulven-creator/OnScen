import { useRef, useState, type ChangeEvent, type PointerEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { captureVideoPosterDataUrl } from '../lib/reelRecording';
import { DEFAULT_STORY_LINK_POSITION } from '../lib/storyLink';
import {
  ACCEPTED_STORY_VIDEO_FORMATS,
  fileToStoryVideoDataUrl,
  validateStoryVideoFile,
} from '../lib/storyVideo';
import { StoryCameraView, type StoryVideoCaptureResult } from './StoryCameraView';
import { StoryCatalogLinkPicker } from './StoryCatalogLinkPicker';
import { StoryImageEditor, type StoryEditorResult } from './StoryImageEditor';
import { StoryLinkOverlay } from './StoryLinkSticker';
import type { MapStory, StoryLink, StoryMusicTrack, StoryTaggedUser } from '../types';

type StoryPhase = 'camera' | 'review';
type CapturedKind = 'photo' | 'video';

interface MapStorySheetProps {
  token: string;
  onClose: () => void;
  onPublished: (story: MapStory) => void;
}

function IconClose({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
    </svg>
  );
}

function IconBack({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconPencil({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M12 20h9" strokeLinecap="round" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PreviewBadge({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-black/50 backdrop-blur-md px-2.5 py-1 text-[11px] font-medium text-white ring-1 ring-white/15">
      {icon}
      <span className="truncate max-w-[140px]">{label}</span>
    </span>
  );
}

export function MapStorySheet({ token, onClose, onPublished }: MapStorySheetProps) {
  const { t } = useTranslation();
  const videoGalleryRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<StoryPhase>('camera');
  const [capturedKind, setCapturedKind] = useState<CapturedKind>('photo');
  const [imageUrl, setImageUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [videoDurationSec, setVideoDurationSec] = useState(0);
  const [editorDraftUrl, setEditorDraftUrl] = useState('');
  const [imageSource, setImageSource] = useState<File | string | null>(null);
  const [musicTrack, setMusicTrack] = useState<StoryMusicTrack | null>(null);
  const [taggedUsers, setTaggedUsers] = useState<StoryTaggedUser[]>([]);
  const [storyLink, setStoryLink] = useState<StoryLink | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [catalogPickerOpen, setCatalogPickerOpen] = useState(false);
  const [mediaAttaching, setMediaAttaching] = useState(false);
  const videoLinkDragRef = useRef<{
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
  } | null>(null);
  const videoPreviewRef = useRef<HTMLDivElement>(null);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<'public' | 'followers'>('followers');

  const openEditorWithDraft = (url: string, source?: File | string) => {
    setEditorDraftUrl(url);
    setImageSource(source ?? url);
    setEditorOpen(true);
  };

  const goToReviewAsVideo = (result: StoryVideoCaptureResult) => {
    setCapturedKind('video');
    setVideoUrl(result.videoUrl);
    setVideoDurationSec(result.durationSec);
    if (result.posterUrl) setImageUrl(result.posterUrl);
    setMusicTrack(null);
    setTaggedUsers([]);
    setStoryLink(null);
    setPhase('review');
  };

  const handleCameraPhoto = (dataUrl: string) => {
    setError(null);
    openEditorWithDraft(dataUrl, dataUrl);
  };

  const handleCameraVideo = (result: StoryVideoCaptureResult) => {
    setError(null);
    goToReviewAsVideo(result);
  };

  const attachVideoFromFile = async (file: File) => {
    const validation = await validateStoryVideoFile(file);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }
    setMediaAttaching(true);
    setError(null);
    try {
      const url = await fileToStoryVideoDataUrl(file);
      const video = document.createElement('video');
      video.preload = 'auto';
      video.muted = true;
      video.playsInline = true;
      await new Promise<void>((resolve, reject) => {
        video.onloadeddata = () => resolve();
        video.onerror = () => reject(new Error('Aperçu vidéo impossible'));
        video.src = url;
      });
      const posterUrl = captureVideoPosterDataUrl(video) ?? '';
      goToReviewAsVideo({
        videoUrl: url,
        posterUrl,
        durationSec: validation.durationSec,
      });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : t('stories.createVideoAttachError', { defaultValue: "Impossible d'ajouter la vidéo." })
      );
    } finally {
      setMediaAttaching(false);
    }
  };

  const handleEditorConfirm = (result: StoryEditorResult) => {
    setImageUrl(result.imageUrl);
    setImageSource(result.imageUrl);
    setEditorDraftUrl('');
    setMusicTrack(result.musicTrack);
    setTaggedUsers(result.taggedUsers);
    setStoryLink(result.link);
    setEditorOpen(false);
    if (result.videoUrl?.trim()) {
      setCapturedKind('video');
      setVideoUrl(result.videoUrl.trim());
      setVideoDurationSec(result.videoDurationSec ?? 0);
    } else {
      setCapturedKind('photo');
      setVideoUrl('');
      setVideoDurationSec(0);
    }
    setPhase('review');
  };

  const handleEditorCancel = () => {
    setEditorDraftUrl('');
    setEditorOpen(false);
    if (!imageUrl.trim()) setPhase('camera');
  };

  const retake = () => {
    setPhase('camera');
    setImageUrl('');
    setVideoUrl('');
    setVideoDurationSec(0);
    setEditorDraftUrl('');
    setImageSource(null);
    setMusicTrack(null);
    setTaggedUsers([]);
    setStoryLink(null);
    setError(null);
  };

  const hasPhotoReady = capturedKind === 'photo' && Boolean(imageUrl.trim());
  const hasVideoReady = capturedKind === 'video' && Boolean(videoUrl.trim());
  const canPublish = phase === 'review' && (hasPhotoReady || hasVideoReady);
  const isBusy = publishing || mediaAttaching;

  const publish = async () => {
    if (!canPublish || isBusy) return;
    setPublishing(true);
    setError(null);
    try {
      const body: {
        imageUrl?: string;
        videoUrl?: string;
        videoDurationSec?: number;
        musicTrack?: StoryMusicTrack;
        taggedUserIds?: string[];
        link?: StoryLink;
        visibility?: 'public' | 'followers';
      } = {};
      if (hasVideoReady) {
        body.videoUrl = videoUrl.trim();
        body.videoDurationSec = videoDurationSec || undefined;
        if (imageUrl.trim()) body.imageUrl = imageUrl.trim();
      } else if (imageUrl.trim()) {
        body.imageUrl = imageUrl.trim();
      }
      if (musicTrack) body.musicTrack = musicTrack;
      if (taggedUsers.length) body.taggedUserIds = taggedUsers.map((u) => u.id);
      if (storyLink?.url) body.link = storyLink;
      const r = await api.createStory(token, { ...body, visibility });
      onPublished(r.story);
      onClose();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : t('stories.createPublishError', { defaultValue: 'Publication impossible.' })
      );
    } finally {
      setPublishing(false);
    }
  };

  const handleVideoFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) void attachVideoFromFile(f);
    e.target.value = '';
  };

  const ensureVideoStoryLink = (): StoryLink => {
    if (storyLink) return storyLink;
    const draft: StoryLink = {
      url: '',
      label: '',
      x: DEFAULT_STORY_LINK_POSITION.x,
      y: DEFAULT_STORY_LINK_POSITION.y,
    };
    setStoryLink(draft);
    return draft;
  };

  const onVideoLinkPointerDown = (e: PointerEvent) => {
    if (!storyLink) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    videoLinkDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      baseX: storyLink.x,
      baseY: storyLink.y,
    };
  };

  const onVideoLinkPointerMove = (e: PointerEvent) => {
    const drag = videoLinkDragRef.current;
    const box = videoPreviewRef.current;
    if (!drag || !box) return;
    const rect = box.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dx = (e.clientX - drag.startX) / rect.width;
    const dy = (e.clientY - drag.startY) / rect.height;
    setStoryLink((prev) =>
      prev
        ? {
            ...prev,
            x: Math.min(1, Math.max(0, drag.baseX + dx)),
            y: Math.min(1, Math.max(0, drag.baseY + dy)),
          }
        : prev
    );
  };

  const onVideoLinkPointerUp = (e: PointerEvent) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    videoLinkDragRef.current = null;
  };

  return (
    <>
      {phase === 'camera' && !editorOpen ? (
        <StoryCameraView
          onPhotoCapture={handleCameraPhoto}
          onVideoCapture={handleCameraVideo}
          onImportVideo={() => videoGalleryRef.current?.click()}
          onClose={onClose}
        />
      ) : null}

      {phase === 'review' ? (
        <div
          className="fixed inset-0 z-[120] bg-black"
          role="dialog"
          aria-modal="true"
          onPointerMove={onVideoLinkPointerMove}
          onPointerUp={onVideoLinkPointerUp}
          onPointerCancel={onVideoLinkPointerUp}
        >
          <div ref={videoPreviewRef} className="absolute inset-0">
            {hasVideoReady ? (
              <video
                key={videoUrl}
                src={videoUrl}
                poster={imageUrl || undefined}
                className="h-full w-full object-cover"
                playsInline
                autoPlay
                loop
                muted
              />
            ) : (
              <img
                key={imageUrl}
                src={imageUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            )}
            {!hasPhotoReady && storyLink?.url ? (
              <StoryLinkOverlay
                link={storyLink}
                interactive="drag"
                onPointerDown={onVideoLinkPointerDown}
              />
            ) : null}
          </div>

          <div className="absolute inset-0 flex flex-col pointer-events-none">
            <div className="shrink-0 flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-4 bg-gradient-to-b from-black/70 to-transparent pointer-events-auto">
              <button
                type="button"
                onClick={retake}
                className="min-w-11 min-h-11 flex items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md"
                aria-label={t('stories.createRetake', { defaultValue: 'Recommencer' })}
              >
                <IconBack className="w-6 h-6" />
              </button>
              {hasPhotoReady ? (
                <button
                  type="button"
                  onClick={() => setEditorOpen(true)}
                  className="min-h-11 px-4 flex items-center gap-2 rounded-full bg-black/40 text-white text-xs font-semibold backdrop-blur-md"
                >
                  <IconPencil className="w-4 h-4" />
                  {t('stories.createEdit', { defaultValue: 'Modifier' })}
                </button>
              ) : hasVideoReady ? (
                <button
                  type="button"
                  onClick={() => {
                    ensureVideoStoryLink();
                    setCatalogPickerOpen(true);
                  }}
                  className="min-h-11 px-3 flex items-center gap-1.5 rounded-full bg-black/40 text-white text-xs font-semibold backdrop-blur-md"
                >
                  <span aria-hidden>♪</span>
                  {t('stories.createCatalogLink', { defaultValue: 'Album / Son' })}
                </button>
              ) : (
                <span className="text-xs font-semibold text-white/80 tabular-nums">
                  {hasVideoReady
                    ? t('stories.createVideoDuration', {
                        sec: videoDurationSec,
                        defaultValue: '{{sec}} s',
                      })
                    : ''}
                </span>
              )}
              <button
                type="button"
                onClick={onClose}
                className="min-w-11 min-h-11 flex items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md"
                aria-label={t('stories.createClose', { defaultValue: 'Fermer' })}
              >
                <IconClose className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1" />

            <div className="shrink-0 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-8 bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-auto space-y-3">
              {(hasPhotoReady || hasVideoReady) &&
              (musicTrack || taggedUsers.length > 0 || storyLink?.url) ? (
                <div className="flex flex-wrap gap-2 justify-center">
                  {musicTrack ? (
                    <PreviewBadge icon={<span aria-hidden>🎵</span>} label={musicTrack.title} />
                  ) : null}
                  {taggedUsers.length > 0 ? (
                    <PreviewBadge
                      icon={<span aria-hidden>@</span>}
                      label={t('stories.createTagsCount', {
                        count: taggedUsers.length,
                        defaultValue: '{{count}} tag',
                      })}
                    />
                  ) : null}
                  {storyLink?.url ? (
                    <PreviewBadge
                      icon={<span aria-hidden>♪</span>}
                      label={storyLink.label?.trim() || t('stories.createLinkBadge', { defaultValue: 'Lien' })}
                    />
                  ) : null}
                </div>
              ) : null}

              <div className="flex rounded-full bg-white/10 backdrop-blur-md p-1 ring-1 ring-white/15">
                <button
                  type="button"
                  onClick={() => setVisibility('followers')}
                  className={`flex-1 min-h-10 rounded-full text-xs font-bold transition-all ${
                    visibility === 'followers' ? 'bg-white text-black' : 'text-white/60'
                  }`}
                >
                  {t('stories.createVisibilityFollowers', { defaultValue: 'Abonnés' })}
                </button>
                <button
                  type="button"
                  onClick={() => setVisibility('public')}
                  className={`flex-1 min-h-10 rounded-full text-xs font-bold transition-all ${
                    visibility === 'public' ? 'bg-white text-black' : 'text-white/60'
                  }`}
                >
                  {t('stories.createVisibilityPublic', { defaultValue: 'Public' })}
                </button>
              </div>

              {error ? (
                <p className="text-center text-xs text-red-300 px-2">{error}</p>
              ) : null}

              <button
                type="button"
                onClick={() => void publish()}
                disabled={!canPublish || isBusy}
                className={`w-full min-h-12 rounded-full text-sm font-bold transition-all ${
                  canPublish && !isBusy
                    ? 'bg-white text-black hover:bg-white/90 active:scale-[0.98]'
                    : 'bg-white/20 text-white/40 cursor-not-allowed'
                }`}
              >
                {publishing
                  ? t('stories.createPublishing', { defaultValue: 'Publication…' })
                  : t('stories.createShare', { defaultValue: 'Partager en story' })}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <input
        ref={videoGalleryRef}
        type="file"
        accept={ACCEPTED_STORY_VIDEO_FORMATS}
        className="hidden"
        onChange={handleVideoFileChange}
      />

      {editorOpen && (editorDraftUrl || imageUrl) ? (
        <StoryImageEditor
          token={token}
          initialImage={editorDraftUrl || imageUrl}
          initialSource={imageSource ?? editorDraftUrl ?? imageUrl}
          initialMusicTrack={musicTrack}
          initialTaggedUsers={taggedUsers}
          initialLink={storyLink}
          onConfirm={handleEditorConfirm}
          onCancel={handleEditorCancel}
        />
      ) : null}

      {catalogPickerOpen ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center ms-modal-overlay bg-black/70 px-0 sm:px-4">
          <div
            className="w-full max-w-md max-h-[90dvh] rounded-2xl ms-modal-panel bg-[#12121a] border border-[#2d2d3d] flex flex-col overflow-hidden"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#2d2d3d]">
              <h3 className="text-sm font-semibold text-white">
                {t('stories.createCatalogLinkTitle', { defaultValue: 'Lier un album ou un son' })}
              </h3>
              <button
                type="button"
                onClick={() => setCatalogPickerOpen(false)}
                className="min-w-11 min-h-11 flex items-center justify-center text-gray-400"
                aria-label={t('stories.createClose', { defaultValue: 'Fermer' })}
              >
                <IconClose className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <StoryCatalogLinkPicker
                token={token}
                onSelect={(selection) => {
                  setStoryLink({
                    url: selection.url,
                    label: selection.label,
                    x: storyLink?.x ?? DEFAULT_STORY_LINK_POSITION.x,
                    y: storyLink?.y ?? DEFAULT_STORY_LINK_POSITION.y,
                  });
                  setCatalogPickerOpen(false);
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
