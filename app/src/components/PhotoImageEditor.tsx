import { useCallback, useRef, useState, type ReactNode } from 'react';
import { PHOTO_FILTERS, getPhotoFilterCss, type PhotoFilterId } from '../lib/photoFilters';
import {
  composeFeedImageWithEdits,
  composeProfileImageWithEdits,
  composeStoryImageWithOverlays,
  type StoryTextOverlay,
} from '../lib/storyImageCompose';
import type { StoryMusicTrack, StoryTaggedUser } from '../types';
import { StoryImageCropModal, type PhotoCropAspect } from './StoryImageCropModal';
import { StoryMusicPicker } from './StoryMusicPicker';
import { StoryUserTagPicker } from './StoryUserTagPicker';

const TEXT_COLORS = ['#ffffff', '#000000', '#fbbf24', '#f472b6', '#60a5fa', '#34d399'];

export type PhotoEditorMode = 'story' | 'profile' | 'feed';

export interface PhotoEditorResult {
  imageUrl: string;
  musicTrack: StoryMusicTrack | null;
  taggedUsers: StoryTaggedUser[];
}

interface PhotoImageEditorProps {
  mode: PhotoEditorMode;
  token?: string;
  initialImage: string;
  initialSource?: File | string;
  initialMusicTrack?: StoryMusicTrack | null;
  initialTaggedUsers?: StoryTaggedUser[];
  onConfirm: (result: PhotoEditorResult) => void;
  onCancel: () => void;
}

type EditorTab = 'texte' | 'filtre' | 'musique' | 'taguer';

function newOverlayId(): string {
  return `o-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function ToolbarIcon({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1 min-w-[52px] py-1 rounded-xl transition-colors ${
        active ? 'text-white' : 'text-white/70 hover:text-white'
      }`}
      aria-label={label}
      aria-pressed={active}
    >
      <span
        className={`flex items-center justify-center w-10 h-10 rounded-full border ${
          active
            ? 'border-white bg-white/15'
            : 'border-white/25 bg-black/30 backdrop-blur-sm hover:border-white/50'
        }`}
      >
        {children}
      </span>
      <span className="text-[10px] font-medium leading-none">{label}</span>
    </button>
  );
}

function IconText() {
  return <span className="text-sm font-bold leading-none">Aa</span>;
}

function IconCrop() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 3v12a3 3 0 0 0 3 3h12M18 21V9a3 3 0 0 0-3-3H3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconFilter() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconMusic() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 18V6l10-2v12M9 18a3 3 0 1 0 0-6M19 16a3 3 0 1 0 0-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconTag() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8" r="3" stroke="currentColor" strokeWidth="2" />
      <path
        d="M6 20v-1a6 6 0 0 1 12 0v1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function PhotoImageEditor({
  mode,
  token = '',
  initialImage,
  initialSource,
  initialMusicTrack = null,
  initialTaggedUsers = [],
  onConfirm,
  onCancel,
}: PhotoImageEditorProps) {
  const isStory = mode === 'story';
  const isFeed = mode === 'feed';
  const cropAspect: PhotoCropAspect = isStory ? 'story' : isFeed ? 'feed' : 'profile';
  const previewAspect = isStory
    ? 'aspect-[9/16]'
    : isFeed
      ? 'aspect-[4/5] max-h-full max-w-[min(100%,28rem)]'
      : 'aspect-square max-h-full max-w-[min(100%,28rem)]';

  const [imageUrl, setImageUrl] = useState(initialImage);
  const [cropSource, setCropSource] = useState<File | string | null>(null);
  const [overlays, setOverlays] = useState<StoryTextOverlay[]>([]);
  const [activeOverlayId, setActiveOverlayId] = useState<string | null>(null);
  const [filterId, setFilterId] = useState<PhotoFilterId>('none');
  const [musicTrack, setMusicTrack] = useState<StoryMusicTrack | null>(initialMusicTrack);
  const [taggedUsers, setTaggedUsers] = useState<StoryTaggedUser[]>(initialTaggedUsers);
  const [tab, setTab] = useState<EditorTab | null>(null);
  const [composing, setComposing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dragRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
  } | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const activeOverlay = overlays.find((o) => o.id === activeOverlayId) ?? null;
  const filterCss = getPhotoFilterCss(filterId);

  const addTextOverlay = () => {
    const id = newOverlayId();
    setOverlays((prev) => [
      ...prev,
      { id, text: 'Votre texte', x: 0.5, y: 0.5, color: '#ffffff', fontSize: 22 },
    ]);
    setActiveOverlayId(id);
    setTab('texte');
  };

  const updateOverlay = (id: string, patch: Partial<StoryTextOverlay>) => {
    setOverlays((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  };

  const removeOverlay = (id: string) => {
    setOverlays((prev) => prev.filter((o) => o.id !== id));
    if (activeOverlayId === id) setActiveOverlayId(null);
  };

  const onOverlayPointerDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    const o = overlays.find((x) => x.id === id);
    if (!o) return;
    setActiveOverlayId(id);
    setTab('texte');
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      baseX: o.x,
      baseY: o.y,
    };
  };

  const onOverlayPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || !previewRef.current) return;
    const rect = previewRef.current.getBoundingClientRect();
    const dx = (e.clientX - d.startX) / rect.width;
    const dy = (e.clientY - d.startY) / rect.height;
    updateOverlay(d.id, {
      x: Math.min(1, Math.max(0, d.baseX + dx)),
      y: Math.min(1, Math.max(0, d.baseY + dy)),
    });
  };

  const onOverlayPointerUp = () => {
    dragRef.current = null;
  };

  const openCrop = () => {
    setTab(null);
    setCropSource(initialSource ?? imageUrl);
  };

  const toggleTab = (next: EditorTab) => {
    setTab((prev) => (prev === next ? null : next));
  };

  const confirm = useCallback(async () => {
    setComposing(true);
    setError(null);
    try {
      const compose = isStory
        ? composeStoryImageWithOverlays
        : isFeed
          ? composeFeedImageWithEdits
          : composeProfileImageWithEdits;
      const composed = await compose(imageUrl, overlays, filterId);
      onConfirm({
        imageUrl: composed,
        musicTrack: isStory ? musicTrack : null,
        taggedUsers: isStory ? taggedUsers : [],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la composition');
    } finally {
      setComposing(false);
    }
  }, [imageUrl, overlays, filterId, musicTrack, taggedUsers, onConfirm, isStory, isFeed]);

  return (
    <>
      <div className="fixed inset-0 z-[125] bg-black overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            ref={previewRef}
            className={`relative h-full w-auto max-w-full ${previewAspect} touch-none select-none overflow-hidden bg-black`}
            onPointerMove={onOverlayPointerMove}
            onPointerUp={onOverlayPointerUp}
            onPointerCancel={onOverlayPointerUp}
            onClick={() => setTab(null)}
          >
            <img
              src={imageUrl}
              alt=""
              className="w-full h-full object-cover pointer-events-none"
              style={{ filter: filterCss }}
              draggable={false}
            />
            {overlays.map((o) => (
              <div
                key={o.id}
                className={`absolute cursor-grab active:cursor-grabbing px-1 ${
                  activeOverlayId === o.id ? 'ring-1 ring-white/80 rounded' : ''
                }`}
                style={{
                  left: `${o.x * 100}%`,
                  top: `${o.y * 100}%`,
                  transform: 'translate(-50%, -50%)',
                  color: o.color,
                  fontSize: o.fontSize,
                  fontWeight: 700,
                  textShadow: '0 1px 4px rgba(0,0,0,0.7)',
                  maxWidth: '90%',
                  textAlign: 'center',
                  wordBreak: 'break-word',
                }}
                onPointerDown={(e) => onOverlayPointerDown(e, o.id)}
                onClick={(e) => e.stopPropagation()}
              >
                {o.text || '…'}
              </div>
            ))}
          </div>
        </div>

        <div
          className="relative z-10 flex flex-col bg-gradient-to-b from-black/90 via-black/55 to-transparent pointer-events-none"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 pointer-events-auto">
            <button
              type="button"
              onClick={onCancel}
              className="text-sm text-white/80 hover:text-white min-w-[4.5rem] text-left"
            >
              Annuler
            </button>
            <h2 className="text-sm font-semibold text-white tracking-wide">
              {isStory ? 'Story' : isFeed ? 'Publication' : 'Photo de profil'}
            </h2>
            <button
              type="button"
              onClick={() => void confirm()}
              disabled={composing}
              className="text-sm font-semibold text-purple-400 hover:text-purple-300 disabled:opacity-40 min-w-[4.5rem] text-right"
            >
              {composing ? '…' : isStory ? 'Suivant' : 'Utiliser'}
            </button>
          </header>

          <nav
            className="flex items-start justify-center gap-2 px-3 pb-2 pointer-events-auto flex-wrap"
            aria-label="Outils de modification"
          >
            <ToolbarIcon label="Texte" active={tab === 'texte'} onClick={addTextOverlay}>
              <IconText />
            </ToolbarIcon>
            <ToolbarIcon label="Rogner" onClick={openCrop}>
              <IconCrop />
            </ToolbarIcon>
            <ToolbarIcon
              label="Filtre"
              active={tab === 'filtre'}
              onClick={() => toggleTab('filtre')}
            >
              <IconFilter />
            </ToolbarIcon>
            {isStory ? (
              <>
                <ToolbarIcon
                  label="Musique"
                  active={tab === 'musique'}
                  onClick={() => toggleTab('musique')}
                >
                  <IconMusic />
                </ToolbarIcon>
                <ToolbarIcon label="Taguer" active={tab === 'taguer'} onClick={() => toggleTab('taguer')}>
                  <IconTag />
                </ToolbarIcon>
              </>
            ) : null}
          </nav>

          {tab === 'texte' && activeOverlay ? (
            <div
              className="mx-3 mb-2 space-y-2 rounded-2xl border border-white/10 p-3 bg-black/75 backdrop-blur-md max-h-[38vh] overflow-y-auto pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="text"
                value={activeOverlay.text}
                onChange={(e) => updateOverlay(activeOverlay.id, { text: e.target.value })}
                placeholder="Écrire sur la photo…"
                className="w-full rounded-xl bg-white/10 border border-white/15 px-3 py-2.5 text-sm text-white placeholder:text-white/40"
              />
              <label className="block">
                <span className="text-[10px] text-white/50 uppercase tracking-wide">Taille</span>
                <input
                  type="range"
                  min={14}
                  max={48}
                  value={activeOverlay.fontSize}
                  onChange={(e) =>
                    updateOverlay(activeOverlay.id, { fontSize: Number(e.target.value) })
                  }
                  className="w-full accent-purple-400"
                />
              </label>
              <div className="flex gap-2 flex-wrap">
                {TEXT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => updateOverlay(activeOverlay.id, { color: c })}
                    className={`w-8 h-8 rounded-full border-2 ${
                      activeOverlay.color === c ? 'border-white' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                    aria-label={`Couleur ${c}`}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => removeOverlay(activeOverlay.id)}
                className="text-[11px] text-red-400 hover:text-red-300"
              >
                Supprimer ce texte
              </button>
            </div>
          ) : null}

          {tab === 'filtre' ? (
            <div
              className="mx-3 mb-2 rounded-2xl border border-white/10 p-3 bg-black/75 backdrop-blur-md pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-[10px] text-white/50 uppercase tracking-wide mb-2">Filtres</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {PHOTO_FILTERS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFilterId(f.id)}
                    className={`shrink-0 flex flex-col items-center gap-1.5 ${
                      filterId === f.id ? 'opacity-100' : 'opacity-70 hover:opacity-90'
                    }`}
                    aria-pressed={filterId === f.id}
                    aria-label={`Filtre ${f.label}`}
                  >
                    <span
                      className={`block w-14 h-14 rounded-xl overflow-hidden border-2 ${
                        filterId === f.id ? 'border-purple-400' : 'border-white/20'
                      }`}
                    >
                      <img
                        src={imageUrl}
                        alt=""
                        className="w-full h-full object-cover"
                        style={{ filter: f.cssFilter }}
                        draggable={false}
                      />
                    </span>
                    <span className="text-[10px] text-white font-medium">{f.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {tab === 'musique' && isStory ? (
            <div
              className="mx-3 mb-2 rounded-2xl border border-white/10 p-3 bg-black/75 backdrop-blur-md max-h-[42vh] overflow-y-auto pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <StoryMusicPicker token={token} value={musicTrack} onChange={setMusicTrack} />
            </div>
          ) : null}

          {tab === 'taguer' && isStory ? (
            <div
              className="mx-3 mb-2 rounded-2xl border border-white/10 p-3 bg-black/75 backdrop-blur-md max-h-[42vh] overflow-y-auto pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <StoryUserTagPicker token={token} tagged={taggedUsers} onChange={setTaggedUsers} />
            </div>
          ) : null}

          {error ? (
            <p className="mx-4 mb-2 text-xs text-red-400 pointer-events-auto">{error}</p>
          ) : null}
        </div>

        {isStory && (musicTrack || taggedUsers.length > 0) && (
          <div className="absolute bottom-0 inset-x-0 z-10 flex flex-wrap justify-center gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-6 bg-gradient-to-t from-black/70 to-transparent pointer-events-none">
            {musicTrack ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-black/50 backdrop-blur-sm border border-white/15 px-3 py-1.5 text-[11px] text-white/90 max-w-[85vw] truncate">
                <IconMusic />
                <span className="truncate">{musicTrack.title}</span>
              </span>
            ) : null}
            {taggedUsers.length > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-black/50 backdrop-blur-sm border border-white/15 px-3 py-1.5 text-[11px] text-white/90">
                <IconTag />
                {taggedUsers.length} tag{taggedUsers.length > 1 ? 's' : ''}
              </span>
            ) : null}
          </div>
        )}
      </div>

      {cropSource ? (
        <StoryImageCropModal
          source={cropSource}
          aspect={cropAspect}
          onConfirm={(url) => {
            setImageUrl(url);
            setCropSource(null);
          }}
          onCancel={() => setCropSource(null)}
        />
      ) : null}
    </>
  );
}
