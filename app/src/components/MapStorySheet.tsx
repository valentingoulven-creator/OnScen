import { useRef, useState } from 'react';
import { useHorizontalSwipe } from '../hooks/useHorizontalSwipe';
import { api } from '../lib/api';
import { fileToFeedImageDataUrl } from '../lib/feedImagePaste';
import { ACCEPTED_IMAGE_FORMATS, validateStoryPhoto } from '../lib/imageConstraints';
import { OpenOnYoutubeButton } from './OpenOnYoutubeButton';
import { StoryImageEditor, type StoryEditorResult } from './StoryImageEditor';
import { UsernameDisplay } from './UsernameDisplay';
import { UserAvatarOnline } from './UserAvatarOnline';
import type { MapStory, StoryMusicTrack, StoryTaggedUser } from '../types';

function formatExpiresIn(expiresAt: number): string {
  const ms = expiresAt - Date.now();
  if (ms <= 0) return 'Expirée';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `Expire dans ${h} h ${m} min`;
  return `Expire dans ${m} min`;
}

interface MapStorySheetProps {
  token: string;
  mode: 'create' | 'view';
  story?: MapStory | null;
  isOwn?: boolean;
  onClose: () => void;
  onPublished: (story: MapStory) => void;
  onRequestCreate?: () => void;
  /** Swipe gauche → story suivante */
  onSwipeNext?: () => void;
  /** Swipe droite → story précédente */
  onSwipePrev?: () => void;
}

export function MapStorySheet({
  token,
  mode,
  story,
  isOwn,
  onClose,
  onPublished,
  onRequestCreate,
  onSwipeNext,
  onSwipePrev,
}: MapStorySheetProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [imageSource, setImageSource] = useState<File | string | null>(null);
  const [musicTrack, setMusicTrack] = useState<StoryMusicTrack | null>(null);
  const [taggedUsers, setTaggedUsers] = useState<StoryTaggedUser[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [imageAttaching, setImageAttaching] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openEditorWithImage = (url: string, source?: File | string) => {
    setImageUrl(url);
    setImageSource(source ?? url);
    setEditorOpen(true);
  };

  const attachImageFromFile = async (file: File) => {
    const validation = validateStoryPhoto(file);
    if (!validation.valid) {
      setError(validation.error ?? 'Fichier non valide.');
      return;
    }
    setImageAttaching(true);
    setError(null);
    try {
      const url = await fileToFeedImageDataUrl(file);
      openEditorWithImage(url, file);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible d'ajouter l'image.");
    } finally {
      setImageAttaching(false);
    }
  };

  const handleEditorConfirm = (result: StoryEditorResult) => {
    setImageUrl(result.imageUrl);
    setMusicTrack(result.musicTrack);
    setTaggedUsers(result.taggedUsers);
    setEditorOpen(false);
  };

  const clearImage = () => {
    setImageUrl('');
    setImageSource(null);
    setMusicTrack(null);
    setTaggedUsers([]);
  };

  const canPublish = Boolean(imageUrl.trim());

  const publish = async () => {
    if (!canPublish || publishing || imageAttaching) return;
    setPublishing(true);
    setError(null);
    try {
      const body: {
        imageUrl: string;
        musicTrack?: StoryMusicTrack;
        taggedUserIds?: string[];
      } = {
        imageUrl: imageUrl.trim(),
      };
      if (musicTrack) body.musicTrack = musicTrack;
      if (taggedUsers.length) body.taggedUserIds = taggedUsers.map((t) => t.id);
      const r = await api.createStory(token, body);
      onPublished(r.story);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Publication impossible.');
    } finally {
      setPublishing(false);
    }
  };

  const swipeEnabled = mode === 'view' && Boolean(onSwipeNext || onSwipePrev);
  const swipeHandlers = useHorizontalSwipe({
    enabled: swipeEnabled,
    onSwipeLeft: onSwipeNext,
    onSwipeRight: onSwipePrev,
    threshold: 50,
  });

  if (mode === 'view' && story) {
    return (
      <div
        className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/80 p-0 sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Story"
        onClick={onClose}
      >
        <div
          className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-[#12121a] border border-[#2d2d3d] shadow-2xl"
          onClick={(e) => e.stopPropagation()}
          {...(swipeEnabled ? swipeHandlers : {})}
        >
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[#2d2d3d]">
            <div className="flex items-center gap-2 min-w-0">
              <UserAvatarOnline
                userId={story.author.id}
                username={story.author.username}
                avatarUrl={story.author.avatarUrl}
                size="sm"
              />
              <div className="min-w-0">
                <UsernameDisplay
                  username={story.author.username}
                  usernameColor={story.author.usernameColor}
                  usernameWaveFrom={story.author.usernameWaveFrom}
                  usernameWaveTo={story.author.usernameWaveTo}
                  className="text-sm font-semibold truncate block"
                />
                <p className="text-[10px] text-gray-500">{formatExpiresIn(story.expiresAt)}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#1a1a26]"
              aria-label="Fermer"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div className="p-4 space-y-3">
            {story.imageUrl ? (
              <img
                src={story.imageUrl}
                alt=""
                className="w-full max-h-[50vh] object-contain rounded-xl bg-black/40"
              />
            ) : null}
            {story.content ? (
              <p className="text-sm text-gray-200 whitespace-pre-wrap break-words">{story.content}</p>
            ) : null}

            {story.musicTrack ? (
              <div className="flex items-center gap-2 rounded-xl bg-[#0b0b0f] border border-[#2d2d3d] px-3 py-2">
                <span className="text-lg" aria-hidden>
                  🎵
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-white font-medium truncate">{story.musicTrack.title}</p>
                  {story.musicTrack.artist ? (
                    <p className="text-[10px] text-gray-500 truncate">{story.musicTrack.artist}</p>
                  ) : null}
                </div>
                {story.musicTrack.videoId ? (
                  <OpenOnYoutubeButton trackId={story.musicTrack.videoId} variant="youtube-red" label="Écouter" />
                ) : story.musicTrack.url ? (
                  <a
                    href={story.musicTrack.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-red-400 hover:text-red-300 shrink-0"
                  >
                    Écouter
                  </a>
                ) : null}
              </div>
            ) : null}

            {story.taggedUsers && story.taggedUsers.length > 0 ? (
              <div className="space-y-1">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">Tagué</p>
                <div className="flex flex-wrap gap-1.5">
                  {story.taggedUsers.map((t) => (
                    <span
                      key={t.id}
                      className="inline-flex items-center gap-1 rounded-full bg-purple-600/15 border border-purple-500/25 pl-1 pr-2 py-0.5"
                    >
                      <UserAvatarOnline
                        userId={t.id}
                        username={t.username}
                        avatarUrl={t.avatarUrl}
                        size="sm"
                      />
                      <UsernameDisplay
                        username={t.username}
                        usernameColor={t.usernameColor}
                        usernameWaveFrom={t.usernameWaveFrom}
                        usernameWaveTo={t.usernameWaveTo}
                        className="text-[10px] font-medium"
                      />
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {isOwn && onRequestCreate ? (
              <button
                type="button"
                onClick={onRequestCreate}
                className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold"
              >
                Publier une nouvelle story
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/80 p-0 sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Créer une story"
        onClick={onClose}
      >
        <div
          className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-[#12121a] border border-[#2d2d3d] shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#2d2d3d]">
            <h2 className="text-sm font-bold text-white">Nouvelle story</h2>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#1a1a26]"
              aria-label="Fermer"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div className="p-4 space-y-3">
            <p className="text-[11px] text-gray-500">
              Ajoutez une photo — visible 24 h sur la carte pour les personnes à proximité.
            </p>

            {imageUrl ? (
              <div className="relative">
                <img src={imageUrl} alt="" className="w-full max-h-48 object-cover rounded-xl" />
                <div className="absolute top-2 left-2 flex gap-1">
                  <button
                    type="button"
                    onClick={() => setEditorOpen(true)}
                    className="px-2 py-1 rounded-lg bg-black/70 text-[10px] text-white hover:bg-black/90"
                  >
                    Modifier
                  </button>
                </div>
                <button
                  type="button"
                  onClick={clearImage}
                  className="absolute top-2 right-2 px-2 py-1 rounded-lg bg-black/70 text-[10px] text-white"
                >
                  Retirer
                </button>
                {musicTrack ? (
                  <div className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-1 rounded-lg bg-black/70 text-[10px] text-white">
                    <span aria-hidden>🎵</span>
                    <span className="truncate max-w-[140px]">{musicTrack.title}</span>
                  </div>
                ) : null}
                {taggedUsers.length > 0 ? (
                  <div className="absolute bottom-2 right-2 px-2 py-1 rounded-lg bg-black/70 text-[10px] text-white">
                    @{taggedUsers.length}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={imageAttaching}
                className="flex-1 py-2 rounded-xl border border-[#2d2d3d] text-xs text-gray-300 hover:border-purple-500/50"
              >
                {imageAttaching ? 'Traitement…' : 'Photo / galerie'}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPTED_IMAGE_FORMATS}
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void attachImageFromFile(f);
                  e.target.value = '';
                }}
              />
            </div>

            {error ? <p className="text-xs text-red-400">{error}</p> : null}

            <button
              type="button"
              onClick={() => void publish()}
              disabled={!canPublish || publishing || imageAttaching}
              className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-sm font-semibold"
            >
              {publishing ? 'Publication…' : 'Publier (24 h)'}
            </button>
          </div>
        </div>
      </div>

      {editorOpen && imageUrl ? (
        <StoryImageEditor
          token={token}
          initialImage={imageUrl}
          initialSource={imageSource ?? imageUrl}
          initialMusicTrack={musicTrack}
          initialTaggedUsers={taggedUsers}
          onConfirm={handleEditorConfirm}
          onCancel={() => setEditorOpen(false)}
        />
      ) : null}
    </>
  );
}
