import { useCallback, useRef, useState, type ReactNode } from 'react';
import { PHOTO_FILTERS, getPhotoFilterCss, type PhotoFilterId } from '../lib/photoFilters';
import {
  composeFeedImageWithEdits,
  composeProfileImageWithEdits,
  composeStoryImageWithOverlays,
  type StoryTextOverlay,
  type StoryTextOverlayStyle,
} from '../lib/storyImageCompose';
import type { StoryMusicTrack, StoryTaggedUser } from '../types';
import { StoryImageCropModal, type PhotoCropAspect } from './StoryImageCropModal';
import { StoryMusicPicker } from './StoryMusicPicker';
import { StoryUserTagPicker } from './StoryUserTagPicker';

const TEXT_COLORS = ['#ffffff', '#fbbf24', '#f472b6', '#60a5fa', '#34d399', '#000000'];

const TEXT_STYLES: { id: StoryTextOverlayStyle; label: string }[] = [
  { id: 'plain', label: 'Classique' },
  { id: 'background', label: 'Fond' },
  { id: 'outline', label: 'Contour' },
];

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

function overlayPreviewStyle(o: StoryTextOverlay, isActive: boolean): React.CSSProperties {
  const style = o.style ?? 'plain';
  const base: React.CSSProperties = {
    left: `${o.x * 100}%`,
    top: `${o.y * 100}%`,
    transform: 'translate(-50%, -50%)',
    fontSize: o.fontSize,
    fontWeight: 700,
    maxWidth: '88%',
    textAlign: 'center',
    wordBreak: 'break-word',
  };

  if (style === 'background') {
    return {
      ...base,
      color: '#111111',
      backgroundColor: 'rgba(255,255,255,0.92)',
      padding: '6px 14px',
      borderRadius: 6,
      boxShadow: isActive ? '0 0 0 2px rgba(168,85,247,0.9)' : undefined,
    };
  }

  if (style === 'outline') {
    return {
      ...base,
      color: '#ffffff',
      WebkitTextStroke: `1.5px ${o.color}`,
      paintOrder: 'stroke fill',
    };
  }

  return {
    ...base,
    color: o.color,
    textShadow: '0 1px 4px rgba(0,0,0,0.75)',
    boxShadow: isActive ? '0 0 0 2px rgba(168,85,247,0.55)' : undefined,
    borderRadius: isActive ? 4 : undefined,
  };
}

function DockTool({
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
      className={`flex flex-col items-center gap-1 min-w-[56px] py-1 transition-colors ${
        active ? 'text-purple-300' : 'text-gray-400 hover:text-white'
      }`}
      aria-label={label}
      aria-pressed={active}
    >
      <span
        className={`flex items-center justify-center w-11 h-11 rounded-2xl transition-all ${
          active
            ? 'bg-purple-600/30 border border-purple-500/60 text-white'
            : 'bg-[#1a1a26] border border-[#2d2d3d] text-gray-300 hover:border-purple-500/40'
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

function ToolSheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="mx-2 mb-2 rounded-2xl border border-[#2d2d3d] bg-[#12121a]/98 backdrop-blur-xl shadow-2xl pointer-events-auto"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#2d2d3d]">
        <h3 className="text-xs font-semibold text-white tracking-wide">{title}</h3>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-[#1a1a26]"
          aria-label="Fermer le panneau"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="p-3 max-h-[42vh] overflow-y-auto">{children}</div>
    </div>
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

  const createTextOverlay = (): string => {
    const id = newOverlayId();
    setOverlays((prev) => [
      ...prev,
      { id, text: '', x: 0.5, y: 0.42, color: '#ffffff', fontSize: 28, style: 'plain' },
    ]);
    setActiveOverlayId(id);
    return id;
  };

  const handleTextTool = () => {
    if (tab === 'texte') {
      setTab(null);
      return;
    }
    if (!activeOverlayId) {
      if (overlays.length === 0) {
        createTextOverlay();
      } else {
        setActiveOverlayId(overlays[overlays.length - 1].id);
      }
    }
    setTab('texte');
  };

  const updateOverlay = (id: string, patch: Partial<StoryTextOverlay>) => {
    setOverlays((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  };

  const removeOverlay = (id: string) => {
    setOverlays((prev) => prev.filter((o) => o.id !== id));
    if (activeOverlayId === id) {
      setActiveOverlayId(null);
      if (overlays.length <= 1) setTab(null);
    }
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

  const closePanel = () => setTab(null);

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

  const hasStoryMeta = isStory && (musicTrack || taggedUsers.length > 0);

  return (
    <>
      <div className="fixed inset-0 z-[125] bg-[#0b0b0f] overflow-hidden flex flex-col">
        {/* Header */}
        <header className="relative z-20 flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 bg-gradient-to-b from-[#0b0b0f] via-[#0b0b0f]/90 to-transparent">
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-gray-300 hover:text-white min-w-[4.5rem] text-left"
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

        {/* Preview */}
        <div
          className="relative flex-1 flex items-center justify-center min-h-0 px-2"
          onClick={() => setTab(null)}
        >
          <div
            ref={previewRef}
            className={`relative h-full w-auto max-w-full ${previewAspect} touch-none select-none overflow-hidden rounded-xl bg-black shadow-[0_0_40px_rgba(0,0,0,0.5)]`}
            onPointerMove={onOverlayPointerMove}
            onPointerUp={onOverlayPointerUp}
            onPointerCancel={onOverlayPointerUp}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={imageUrl}
              alt=""
              className="w-full h-full object-cover pointer-events-none"
              style={{ filter: filterCss }}
              draggable={false}
            />
            {overlays.map((o) => {
              const isActive = activeOverlayId === o.id;
              const displayText = o.text.trim();
              return (
                <div
                  key={o.id}
                  className={`absolute cursor-grab active:cursor-grabbing ${
                    isActive ? 'z-10' : 'z-[1]'
                  }`}
                  style={overlayPreviewStyle(o, isActive)}
                  onPointerDown={(e) => onOverlayPointerDown(e, o.id)}
                  onClick={(e) => e.stopPropagation()}
                >
                  {displayText ? (
                    displayText
                  ) : isActive ? (
                    <span className="text-white/45 italic text-[0.85em] font-medium">Tapez…</span>
                  ) : null}
                </div>
              );
            })}
          </div>

          {hasStoryMeta ? (
            <div className="absolute bottom-2 inset-x-4 flex flex-wrap justify-center gap-2 pointer-events-none z-10">
              {musicTrack ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-black/55 backdrop-blur-sm border border-[#2d2d3d] px-3 py-1.5 text-[11px] text-white/90 max-w-[85vw] truncate">
                  <IconMusic />
                  <span className="truncate">{musicTrack.title}</span>
                </span>
              ) : null}
              {taggedUsers.length > 0 ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-black/55 backdrop-blur-sm border border-[#2d2d3d] px-3 py-1.5 text-[11px] text-white/90">
                  <IconTag />
                  {taggedUsers.length} tag{taggedUsers.length > 1 ? 's' : ''}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Bottom dock + panels */}
        <div className="relative z-20 shrink-0 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {tab === 'texte' && activeOverlay ? (
            <ToolSheet title="Texte" onClose={closePanel}>
              <div className="space-y-3">
                <input
                  type="text"
                  value={activeOverlay.text}
                  onChange={(e) => updateOverlay(activeOverlay.id, { text: e.target.value })}
                  placeholder="Écrire sur la photo…"
                  autoFocus
                  className="w-full rounded-xl bg-[#0b0b0f] border border-[#2d2d3d] px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:border-purple-500/60 focus:outline-none"
                />

                <div className="flex gap-1.5">
                  {TEXT_STYLES.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => updateOverlay(activeOverlay.id, { style: s.id })}
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-medium transition ${
                        (activeOverlay.style ?? 'plain') === s.id
                          ? 'bg-purple-600 text-white'
                          : 'bg-[#0b0b0f] text-gray-400 border border-[#2d2d3d] hover:text-white'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wide shrink-0">Taille</span>
                  <input
                    type="range"
                    min={14}
                    max={48}
                    value={activeOverlay.fontSize}
                    onChange={(e) =>
                      updateOverlay(activeOverlay.id, { fontSize: Number(e.target.value) })
                    }
                    className="flex-1 accent-purple-500"
                  />
                  <span className="text-[10px] text-gray-400 w-6 text-right">{activeOverlay.fontSize}</span>
                </div>

                <div className="flex gap-2 flex-wrap justify-center">
                  {TEXT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => updateOverlay(activeOverlay.id, { color: c })}
                      className={`w-8 h-8 rounded-full border-2 transition ${
                        activeOverlay.color === c
                          ? 'border-purple-400 scale-110'
                          : 'border-[#2d2d3d] hover:border-gray-500'
                      }`}
                      style={{ backgroundColor: c }}
                      aria-label={`Couleur ${c}`}
                    />
                  ))}
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      createTextOverlay();
                    }}
                    className="flex-1 py-2 rounded-xl border border-[#2d2d3d] text-[11px] text-gray-300 hover:border-purple-500/50 hover:text-white"
                  >
                    + Ajouter un texte
                  </button>
                  <button
                    type="button"
                    onClick={() => removeOverlay(activeOverlay.id)}
                    className="px-3 py-2 rounded-xl text-[11px] text-red-400 hover:bg-red-500/10"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            </ToolSheet>
          ) : null}

          {tab === 'filtre' ? (
            <ToolSheet title="Filtres" onClose={closePanel}>
              <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1">
                {PHOTO_FILTERS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFilterId(f.id)}
                    className={`shrink-0 flex flex-col items-center gap-1.5 transition ${
                      filterId === f.id ? 'opacity-100' : 'opacity-65 hover:opacity-90'
                    }`}
                    aria-pressed={filterId === f.id}
                    aria-label={`Filtre ${f.label}`}
                  >
                    <span
                      className={`block w-16 h-16 rounded-xl overflow-hidden border-2 ${
                        filterId === f.id ? 'border-purple-500' : 'border-[#2d2d3d]'
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
                    <span className="text-[10px] text-gray-300 font-medium">{f.label}</span>
                  </button>
                ))}
              </div>
            </ToolSheet>
          ) : null}

          {tab === 'musique' && isStory ? (
            <ToolSheet title="Musique" onClose={closePanel}>
              <StoryMusicPicker token={token} value={musicTrack} onChange={setMusicTrack} />
            </ToolSheet>
          ) : null}

          {tab === 'taguer' && isStory ? (
            <ToolSheet title="Taguer" onClose={closePanel}>
              <StoryUserTagPicker token={token} tagged={taggedUsers} onChange={setTaggedUsers} />
            </ToolSheet>
          ) : null}

          {error ? <p className="mx-4 mb-2 text-xs text-red-400">{error}</p> : null}

          <nav
            className="flex items-start justify-center gap-1 px-3 pt-2 border-t border-[#2d2d3d] bg-[#12121a]/95 backdrop-blur-md"
            aria-label="Outils de modification"
          >
            <DockTool label="Texte" active={tab === 'texte'} onClick={handleTextTool}>
              <IconText />
            </DockTool>
            <DockTool label="Rogner" onClick={openCrop}>
              <IconCrop />
            </DockTool>
            <DockTool label="Filtre" active={tab === 'filtre'} onClick={() => toggleTab('filtre')}>
              <IconFilter />
            </DockTool>
            {isStory ? (
              <>
                <DockTool
                  label="Musique"
                  active={tab === 'musique'}
                  onClick={() => toggleTab('musique')}
                >
                  <IconMusic />
                </DockTool>
                <DockTool label="Taguer" active={tab === 'taguer'} onClick={() => toggleTab('taguer')}>
                  <IconTag />
                </DockTool>
              </>
            ) : null}
          </nav>
        </div>
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
