import { useRef, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import { fileToFeedImageDataUrl } from '../lib/feedImagePaste';
import { ACCEPTED_IMAGE_FORMATS, validateStoryPhotoAsync } from '../lib/imageConstraints';
import { prepareImageFile } from '../lib/imageUtils';
import { StoryImageEditor, type StoryEditorResult } from './StoryImageEditor';
import type { MapStory, StoryLink, StoryMusicTrack, StoryTaggedUser } from '../types';

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

function IconImagePlus({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="8.5" cy="8.5" r="1.75" />
      <path d="M21 15l-5-5L5 21" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 7h7M17.5 3.5v7" strokeLinecap="round" />
    </svg>
  );
}

function IconUsers({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" strokeLinecap="round" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" />
    </svg>
  );
}

function IconGlobe({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" strokeLinecap="round" />
    </svg>
  );
}

function IconMusic({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M9 18V6l10-2v12" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9" cy="18" r="3" />
      <circle cx="19" cy="16" r="3" />
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

function IconTrash({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconLink({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" strokeLinecap="round" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" strokeLinecap="round" />
    </svg>
  );
}

function IconTag({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="12" cy="8" r="3" />
      <path d="M6 20v-1a6 6 0 0 1 12 0v1" strokeLinecap="round" />
    </svg>
  );
}

function PreviewBadge({
  icon,
  label,
}: {
  icon: ReactNode;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-lg bg-black/65 backdrop-blur-sm px-2 py-1 text-[11px] font-medium text-white/95">
      {icon}
      <span className="truncate max-w-[120px]">{label}</span>
    </span>
  );
}

export function MapStorySheet({
  token,
  onClose,
  onPublished,
}: MapStorySheetProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  /** JPEG composé (filtres, texte, tags) — aperçu + publication. */
  const [imageUrl, setImageUrl] = useState('');
  /** Brouillon brut pendant la première sélection ou « Changer la photo ». */
  const [editorDraftUrl, setEditorDraftUrl] = useState('');
  const [imageSource, setImageSource] = useState<File | string | null>(null);
  const [musicTrack, setMusicTrack] = useState<StoryMusicTrack | null>(null);
  const [taggedUsers, setTaggedUsers] = useState<StoryTaggedUser[]>([]);
  const [storyLink, setStoryLink] = useState<StoryLink | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [imageAttaching, setImageAttaching] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visibility, _setVisibility] = useState<'public' | 'followers'>('followers');

  const openEditorWithDraft = (url: string, source?: File | string) => {
    setEditorDraftUrl(url);
    setImageSource(source ?? url);
    setEditorOpen(true);
  };

  const attachImageFromFile = async (file: File) => {
    const validation = await validateStoryPhotoAsync(file);
    if (!validation.valid) {
      setError(validation.error ?? 'Fichier non valide.');
      return;
    }
    setImageAttaching(true);
    setError(null);
    try {
      const prepared = await prepareImageFile(file);
      const url = await fileToFeedImageDataUrl(prepared);
      openEditorWithDraft(url, prepared);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible d'ajouter l'image.");
    } finally {
      setImageAttaching(false);
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
  };

  const handleEditorCancel = () => {
    setEditorDraftUrl('');
    setEditorOpen(false);
  };

  const clearImage = () => {
    setImageUrl('');
    setEditorDraftUrl('');
    setImageSource(null);
    setMusicTrack(null);
    setTaggedUsers([]);
    setStoryLink(null);
  };

  const canPublish = Boolean(imageUrl.trim());
  const isBusy = publishing || imageAttaching;

  const publish = async () => {
    if (!canPublish || isBusy) return;
    setPublishing(true);
    setError(null);
    try {
      const body: {
        imageUrl?: string;
        musicTrack?: StoryMusicTrack;
        taggedUserIds?: string[];
        link?: StoryLink;
        visibility?: 'public' | 'followers';
      } = {};
      if (imageUrl.trim()) body.imageUrl = imageUrl.trim();
      if (musicTrack) body.musicTrack = musicTrack;
      if (taggedUsers.length) body.taggedUserIds = taggedUsers.map((t) => t.id);
      if (storyLink?.url) body.link = storyLink;
      const r = await api.createStory(token, { ...body, visibility });
      onPublished(r.story);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Publication impossible.');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Créer une story"
        onClick={onClose}
      >
        <div
          className="w-full max-w-md max-h-[min(92dvh,calc(100dvh-env(safe-area-inset-bottom,0px)))] overflow-hidden flex flex-col rounded-2xl bg-[var(--ms-surface)] border border-[var(--ms-border)] shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--ms-border)]/80 shrink-0">
            <div>
              <h2 className="text-[15px] font-semibold text-[var(--ms-text)] tracking-wide">Nouvelle story</h2>
              <p className="text-[11px] text-[var(--ms-text-muted)] mt-0.5">Photo, musique et tags dans l&apos;éditeur</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="min-w-11 min-h-11 flex items-center justify-center p-2 -mr-1 rounded-xl text-[var(--ms-text-muted)] hover:text-[var(--ms-text)] hover:bg-white/5 transition-colors"
              aria-label="Fermer"
            >
              <IconClose className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {imageUrl ? (
              <div className="space-y-3">
                <div className="relative overflow-hidden rounded-2xl border border-[var(--ms-border)] bg-[var(--ms-bg)] mx-auto w-full max-w-[220px] aspect-[9/16]">
                  <img
                    key={imageUrl}
                    src={imageUrl}
                    alt="Aperçu de votre story"
                    className="absolute inset-0 block h-full w-full object-cover object-center"
                  />
                  <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2.5 bg-gradient-to-b from-black/55 to-transparent">
                    <button
                      type="button"
                      onClick={() => setEditorOpen(true)}
                      className="inline-flex items-center justify-center gap-1.5 min-h-11 rounded-lg bg-black/55 backdrop-blur-sm px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-black/75 transition-colors"
                    >
                      <IconPencil className="w-3.5 h-3.5" />
                      Modifier
                    </button>
                    <button
                      type="button"
                      onClick={clearImage}
                      className="inline-flex items-center justify-center gap-1.5 min-h-11 rounded-lg bg-black/55 backdrop-blur-sm px-2.5 py-1.5 text-[11px] font-medium text-white/90 hover:bg-red-500/25 hover:text-white transition-colors"
                    >
                      <IconTrash className="w-3.5 h-3.5" />
                      Retirer
                    </button>
                  </div>
                  {(musicTrack || taggedUsers.length > 0 || storyLink?.url) ? (
                    <div className="absolute inset-x-0 bottom-0 flex flex-wrap gap-1.5 p-2.5 bg-gradient-to-t from-black/60 to-transparent">
                      {musicTrack ? (
                        <PreviewBadge
                          icon={<IconMusic className="w-3 h-3 shrink-0 text-purple-300" />}
                          label={musicTrack.title}
                        />
                      ) : null}
                      {taggedUsers.length > 0 ? (
                        <PreviewBadge
                          icon={<IconTag className="w-3 h-3 shrink-0 text-purple-300" />}
                          label={`${taggedUsers.length} tag${taggedUsers.length > 1 ? 's' : ''}`}
                        />
                      ) : null}
                      {storyLink?.url ? (
                        <PreviewBadge
                          icon={<IconLink className="w-3 h-3 shrink-0 text-purple-300" />}
                          label="Lien"
                        />
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={imageAttaching}
                  className="w-full min-h-11 text-center text-xs font-medium text-[var(--ms-text-muted)] hover:text-[var(--ms-accent)] transition-colors disabled:opacity-50"
                >
                  {imageAttaching ? 'Préparation…' : 'Changer la photo'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={imageAttaching}
                className="group relative w-full min-h-[11rem] overflow-hidden rounded-2xl border border-dashed border-[var(--ms-border)] bg-gradient-to-b from-[var(--ms-accent)]/[0.07] to-[var(--ms-bg)] px-5 py-10 text-center transition-colors hover:border-[var(--ms-accent)]/45 hover:from-[var(--ms-accent)]/[0.12] disabled:opacity-60 disabled:pointer-events-none"
              >
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--ms-surface-2)] border border-[var(--ms-border)] text-[var(--ms-accent)] group-hover:border-[var(--ms-accent)]/40 group-hover:text-purple-300 transition-colors">
                  <IconImagePlus className="w-6 h-6" />
                </div>
                <p className="text-sm font-medium text-[var(--ms-text)]">
                  {imageAttaching ? 'Préparation…' : 'Ajouter une photo'}
                </p>
                <p className="mt-1 text-[11px] text-[var(--ms-text-muted)]">
                  JPG, PNG, WebP ou HEIC — galerie ou appareil photo
                </p>
              </button>
            )}

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

            <div className="space-y-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ms-text-muted)]">
                Visibilité
              </span>
              <div className="flex rounded-xl bg-[var(--ms-bg)] border border-[var(--ms-border)] p-1">
                <button
                  type="button"
                  onClick={() => _setVisibility('followers')}
                  className={`flex-1 flex items-center justify-center gap-2 min-h-11 py-2.5 rounded-lg text-xs font-medium transition-all ${
                    visibility === 'followers'
                      ? 'bg-[var(--ms-surface-2)] text-[var(--ms-text)] shadow-sm ring-1 ring-[var(--ms-accent)]/35'
                      : 'text-[var(--ms-text-muted)] hover:text-gray-300'
                  }`}
                >
                  <IconUsers className={`w-4 h-4 shrink-0 ${visibility === 'followers' ? 'text-[var(--ms-accent)]' : ''}`} />
                  Abonnés
                </button>
                <button
                  type="button"
                  onClick={() => _setVisibility('public')}
                  className={`flex-1 flex items-center justify-center gap-2 min-h-11 py-2.5 rounded-lg text-xs font-medium transition-all ${
                    visibility === 'public'
                      ? 'bg-[var(--ms-surface-2)] text-[var(--ms-text)] shadow-sm ring-1 ring-[var(--ms-accent)]/35'
                      : 'text-[var(--ms-text-muted)] hover:text-gray-300'
                  }`}
                >
                  <IconGlobe className={`w-4 h-4 shrink-0 ${visibility === 'public' ? 'text-[var(--ms-accent)]' : ''}`} />
                  Public
                </button>
              </div>
              <p className="text-[11px] text-[var(--ms-text-muted)] px-0.5">
                {visibility === 'followers'
                  ? 'Visible par vos abonnés uniquement'
                  : 'Visible par tous'}
              </p>
            </div>

            {error ? (
              <p className="rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {error}
              </p>
            ) : null}
          </div>

          <div className="shrink-0 border-t border-[var(--ms-border)]/80 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-[var(--ms-surface)]">
            {!canPublish ? (
              <p className="mb-2.5 text-center text-[11px] text-[var(--ms-text-muted)]">
                Ajoutez une photo pour publier votre story
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => void publish()}
              disabled={!canPublish || isBusy}
              className={`w-full min-h-11 py-3 rounded-xl text-sm font-semibold transition-all ${
                canPublish && !isBusy
                  ? 'bg-gradient-to-r from-purple-600 to-purple-500 text-white shadow-[0_8px_24px_rgba(147,51,234,0.35)] hover:from-purple-500 hover:to-purple-400 active:scale-[0.99]'
                  : 'bg-[var(--ms-surface-2)] text-[var(--ms-text-muted)] cursor-not-allowed'
              }`}
            >
              {publishing ? 'Publication…' : 'Publier'}
            </button>
          </div>
        </div>
      </div>

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
    </>
  );
}
