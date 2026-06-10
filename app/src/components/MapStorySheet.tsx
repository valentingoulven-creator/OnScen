import { useRef, useState } from 'react';
import { api } from '../lib/api';
import { fileToFeedImageDataUrl } from '../lib/feedImagePaste';
import { ACCEPTED_IMAGE_FORMATS, validateStoryPhoto } from '../lib/imageConstraints';
import { StoryImageEditor, type StoryEditorResult } from './StoryImageEditor';
import type { MapStory, StoryMusicTrack, StoryTaggedUser } from '../types';

interface MapStorySheetProps {
  token: string;
  onClose: () => void;
  onPublished: (story: MapStory) => void;
}

export function MapStorySheet({
  token,
  onClose,
  onPublished,
}: MapStorySheetProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [imageSource, setImageSource] = useState<File | string | null>(null);
  const [text, setText] = useState('');
  const [musicTrack, setMusicTrack] = useState<StoryMusicTrack | null>(null);
  const [taggedUsers, setTaggedUsers] = useState<StoryTaggedUser[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [imageAttaching, setImageAttaching] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visibility, _setVisibility] = useState<'public' | 'followers'>('followers');

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

  const canPublish = Boolean(imageUrl.trim() || text.trim());

  const publish = async () => {
    if (!canPublish || publishing || imageAttaching) return;
    setPublishing(true);
    setError(null);
    try {
      const body: {
        content?: string;
        imageUrl?: string;
        musicTrack?: StoryMusicTrack;
        taggedUserIds?: string[];
        visibility?: 'public' | 'followers';
      } = {};
      if (imageUrl.trim()) body.imageUrl = imageUrl.trim();
      if (text.trim()) body.content = text.trim();
      if (musicTrack) body.musicTrack = musicTrack;
      if (taggedUsers.length) body.taggedUserIds = taggedUsers.map((t) => t.id);
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
              Ajoutez une photo et/ou un texte — visible 24 h sur la carte pour les personnes à proximité.
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

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ajouter un texte (optionnel)…"
              rows={2}
              maxLength={300}
              className="w-full rounded-xl bg-[#0b0b0f] border border-[#2a2a3d] px-3 py-2 text-sm text-white placeholder:text-gray-600 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />

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

            <div className="flex gap-2 rounded-xl bg-[#0b0b0f] border border-[#2a2a3d] p-1">
              <button
                type="button"
                onClick={() => _setVisibility('followers')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition ${
                  visibility === 'followers'
                    ? 'bg-purple-700 text-white'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                👥 Abonnés
              </button>
              <button
                type="button"
                onClick={() => _setVisibility('public')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition ${
                  visibility === 'public'
                    ? 'bg-purple-700 text-white'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                🌍 Public
              </button>
            </div>

            <button
              type="button"
              onClick={() => void publish()}
              disabled={!canPublish || publishing || imageAttaching}
              className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-sm font-semibold"
            >
              {publishing ? 'Publication…' : 'Publier'}
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
