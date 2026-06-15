import { useCallback, useRef, useState, type ReactNode } from 'react';
import {
  PHOTO_AI_FILTERS,
  PHOTO_CLASSIC_FILTERS,
  getPhotoFilterCss,
  type PhotoFilterId,
  type PhotoFilterPreset,
} from '../lib/photoFilters';
import {
  composeFeedImageWithEdits,
  composeProfileImageWithEdits,
  composeStoryImageWithOverlays,
  defaultStoryTagPosition,
  resolveStoryTagPosition,
  type StoryTextOverlay,
  type StoryTextOverlayStyle,
} from '../lib/storyImageCompose';
import {
  DEFAULT_STORY_TEXT_FONT_ID,
  resolveStoryTextFont,
  STORY_TEXT_FONTS,
} from '../lib/storyTextFonts';
import {
  DEFAULT_STORY_LINK_POSITION,
  validateStoryLinkUrl,
} from '../lib/storyLink';
import type { StoryLink, StoryMusicTrack, StoryTaggedUser } from '../types';
import { PhotoInlineCrop, type InlineCropControls } from './PhotoInlineCrop';
import type { PhotoCropAspect } from './StoryImageCropModal';
import { StoryLinkOverlay } from './StoryLinkSticker';
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
  link: StoryLink | null;
}

interface PhotoImageEditorProps {
  mode: PhotoEditorMode;
  token?: string;
  initialImage: string;
  initialSource?: File | string;
  initialMusicTrack?: StoryMusicTrack | null;
  initialTaggedUsers?: StoryTaggedUser[];
  initialLink?: StoryLink | null;
  onConfirm: (result: PhotoEditorResult) => void;
  onCancel: () => void;
}

type EditorTab = 'texte' | 'rogner' | 'filtre' | 'musique' | 'taguer' | 'lien';

function newOverlayId(): string {
  return `o-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function tagPreviewStyle(
  x: number,
  y: number,
  isActive: boolean
): React.CSSProperties {
  return {
    left: `${x * 100}%`,
    top: `${y * 100}%`,
    transform: 'translate(-50%, -50%)',
    boxShadow: isActive ? '0 0 0 2px rgba(168,85,247,0.9)' : undefined,
  };
}

function assignDefaultTagPositions(users: StoryTaggedUser[]): StoryTaggedUser[] {
  return users.map((t, i) => {
    if (t.x != null && t.y != null) return t;
    const pos = defaultStoryTagPosition(i, users.length);
    return { ...t, x: pos.x, y: pos.y };
  });
}

function overlayPreviewStyle(o: StoryTextOverlay, isActive: boolean): React.CSSProperties {
  const style = o.style ?? 'plain';
  const font = resolveStoryTextFont(o.fontId);
  const base: React.CSSProperties = {
    left: `${o.x * 100}%`,
    top: `${o.y * 100}%`,
    transform: 'translate(-50%, -50%)',
    fontSize: o.fontSize,
    fontFamily: font.fontFamily,
    fontWeight: font.fontWeight,
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

function IconLink() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FilterThumb({
  preset,
  imageUrl,
  selected,
  onSelect,
}: {
  preset: PhotoFilterPreset;
  imageUrl: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`shrink-0 flex flex-col items-center gap-1.5 transition ${
        selected ? 'opacity-100' : 'opacity-65 hover:opacity-90'
      }`}
      aria-pressed={selected}
      aria-label={`Filtre ${preset.label}`}
    >
      <span
        className={`block w-16 h-16 rounded-xl overflow-hidden border-2 ${
          selected ? 'border-purple-500' : 'border-[#2d2d3d]'
        }`}
      >
        <img
          src={imageUrl}
          alt=""
          className="w-full h-full object-cover"
          style={{ filter: preset.cssFilter }}
          draggable={false}
        />
      </span>
      <span className="text-[10px] text-gray-300 font-medium text-center leading-tight max-w-[4.5rem]">
        {preset.label}
      </span>
    </button>
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
  initialLink = null,
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
  const [cropControls, setCropControls] = useState<InlineCropControls | null>(null);
  const [overlays, setOverlays] = useState<StoryTextOverlay[]>([]);
  const [activeOverlayId, setActiveOverlayId] = useState<string | null>(null);
  const [filterId, setFilterId] = useState<PhotoFilterId>('none');
  const [musicTrack, setMusicTrack] = useState<StoryMusicTrack | null>(initialMusicTrack);
  const [taggedUsers, setTaggedUsers] = useState<StoryTaggedUser[]>(() =>
    assignDefaultTagPositions(initialTaggedUsers)
  );
  const [activeTagId, setActiveTagId] = useState<string | null>(null);
  const [link, setLink] = useState<StoryLink | null>(initialLink);
  const [linkUrlInput, setLinkUrlInput] = useState(initialLink?.url ?? '');
  const [linkLabelInput, setLinkLabelInput] = useState(initialLink?.label ?? '');
  const [linkUrlError, setLinkUrlError] = useState<string | null>(null);
  const [tab, setTab] = useState<EditorTab | null>(null);
  const [composing, setComposing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dragRef = useRef<{
    kind: 'text' | 'tag' | 'link';
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
      {
        id,
        text: '',
        x: 0.5,
        y: 0.42,
        color: '#ffffff',
        fontSize: 28,
        style: 'plain',
        fontId: DEFAULT_STORY_TEXT_FONT_ID,
      },
    ]);
    setActiveOverlayId(id);
    return id;
  };

  const handleTextTool = () => {
    if (tab === 'texte') {
      setTab(null);
      return;
    }
    setCropSource(null);
    setCropControls(null);
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
    setActiveTagId(null);
    setTab('texte');
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      kind: 'text',
      id,
      startX: e.clientX,
      startY: e.clientY,
      baseX: o.x,
      baseY: o.y,
    };
  };

  const onTagPointerDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    const tag = taggedUsers.find((t) => t.id === id);
    if (!tag) return;
    const index = taggedUsers.findIndex((t) => t.id === id);
    const pos = resolveStoryTagPosition(tag, index, taggedUsers.length);
    setActiveTagId(id);
    setActiveOverlayId(null);
    setTab('taguer');
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      kind: 'tag',
      id,
      startX: e.clientX,
      startY: e.clientY,
      baseX: pos.x,
      baseY: pos.y,
    };
  };

  const onLinkPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (!link) return;
    setActiveOverlayId(null);
    setActiveTagId(null);
    setTab('lien');
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      kind: 'link',
      id: 'link',
      startX: e.clientX,
      startY: e.clientY,
      baseX: link.x,
      baseY: link.y,
    };
  };

  const updateLinkPosition = (x: number, y: number) => {
    setLink((prev) => (prev ? { ...prev, x, y } : prev));
  };

  const ensureLinkDraft = (): StoryLink => {
    if (link) return link;
    const draft: StoryLink = {
      url: '',
      label: '',
      x: DEFAULT_STORY_LINK_POSITION.x,
      y: DEFAULT_STORY_LINK_POSITION.y,
    };
    setLink(draft);
    return draft;
  };

  const applyLinkUrl = (raw: string) => {
    setLinkUrlInput(raw);
    const trimmed = raw.trim();
    if (!trimmed) {
      setLinkUrlError(null);
      setLink((prev) => (prev ? { ...prev, url: '' } : prev));
      return;
    }
    const result = validateStoryLinkUrl(trimmed);
    if (!result.ok) {
      setLinkUrlError(result.error);
      return;
    }
    setLinkUrlError(null);
    setLink((prev) => {
      const base = prev ?? {
        url: '',
        label: linkLabelInput,
        x: DEFAULT_STORY_LINK_POSITION.x,
        y: DEFAULT_STORY_LINK_POSITION.y,
      };
      return { ...base, url: result.url };
    });
  };

  const applyLinkLabel = (raw: string) => {
    setLinkLabelInput(raw);
    setLink((prev) => {
      if (!prev) return prev;
      const label = raw.trim();
      return { ...prev, label: label || undefined };
    });
  };

  const handleLinkTool = () => {
    if (tab === 'lien') {
      setTab(null);
      return;
    }
    setCropSource(null);
    setCropControls(null);
    ensureLinkDraft();
    setTab('lien');
  };

  const removeLink = () => {
    setLink(null);
    setLinkUrlInput('');
    setLinkLabelInput('');
    setLinkUrlError(null);
    setTab(null);
  };

  const updateTagPosition = (id: string, x: number, y: number) => {
    setTaggedUsers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, x, y } : t))
    );
  };

  const onPreviewPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || !previewRef.current) return;
    const rect = previewRef.current.getBoundingClientRect();
    const dx = (e.clientX - d.startX) / rect.width;
    const dy = (e.clientY - d.startY) / rect.height;
    const nextX = Math.min(1, Math.max(0, d.baseX + dx));
    const nextY = Math.min(1, Math.max(0, d.baseY + dy));
    if (d.kind === 'text') {
      updateOverlay(d.id, { x: nextX, y: nextY });
    } else if (d.kind === 'tag') {
      updateTagPosition(d.id, nextX, nextY);
    } else {
      updateLinkPosition(nextX, nextY);
    }
  };

  const onPreviewPointerUp = () => {
    dragRef.current = null;
  };

  const onPreviewTap = (e: React.PointerEvent) => {
    if (dragRef.current) return;
    if (!isStory || tab !== 'taguer' || !previewRef.current) return;
    const rect = previewRef.current.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    if (activeTagId) {
      updateTagPosition(activeTagId, x, y);
      return;
    }
    if (taggedUsers.length > 0) {
      const last = taggedUsers[taggedUsers.length - 1];
      setActiveTagId(last.id);
      updateTagPosition(last.id, x, y);
    }
  };

  const handleTaggedUsersChange = (users: StoryTaggedUser[]) => {
    const withPositions = assignDefaultTagPositions(users);
    const added = users.find((u) => !taggedUsers.some((t) => t.id === u.id));
    setTaggedUsers(withPositions);
    if (added) {
      setActiveTagId(added.id);
      setTab('taguer');
    } else if (activeTagId && !withPositions.some((t) => t.id === activeTagId)) {
      setActiveTagId(withPositions.length ? withPositions[withPositions.length - 1].id : null);
    }
  };

  const openCrop = () => {
    if (tab === 'rogner') {
      setTab(null);
      setCropSource(null);
      setCropControls(null);
      return;
    }
    setCropSource(initialSource ?? imageUrl);
    setTab('rogner');
  };

  const handleCropApplied = (url: string) => {
    setImageUrl(url);
    setTab(null);
    setCropSource(null);
    setCropControls(null);
  };

  const toggleTab = (next: EditorTab) => {
    if (next !== 'rogner') {
      setCropSource(null);
      setCropControls(null);
    }
    setTab((prev) => (prev === next ? null : next));
  };

  const closePanel = () => {
    if (tab === 'rogner') {
      setCropSource(null);
      setCropControls(null);
    }
    setTab(null);
  };

  const isCropping = tab === 'rogner' && Boolean(cropSource);

  const confirm = useCallback(async () => {
    setComposing(true);
    setError(null);
    try {
      let resolvedLink: StoryLink | null = link;
      if (link?.url.trim()) {
        const validated = validateStoryLinkUrl(link.url);
        if (!validated.ok) {
          setError(validated.error);
          setTab('lien');
          return;
        }
        resolvedLink = {
          ...link,
          url: validated.url,
          label: link.label?.trim() || undefined,
        };
      } else if (linkUrlInput.trim()) {
        const validated = validateStoryLinkUrl(linkUrlInput);
        if (!validated.ok) {
          setError(validated.error);
          setTab('lien');
          return;
        }
        resolvedLink = {
          url: validated.url,
          label: linkLabelInput.trim() || undefined,
          x: link?.x ?? DEFAULT_STORY_LINK_POSITION.x,
          y: link?.y ?? DEFAULT_STORY_LINK_POSITION.y,
        };
      } else {
        resolvedLink = null;
      }

      const composed = isStory
        ? await composeStoryImageWithOverlays(imageUrl, overlays, filterId, taggedUsers)
        : isFeed
          ? await composeFeedImageWithEdits(imageUrl, overlays, filterId)
          : await composeProfileImageWithEdits(imageUrl, overlays, filterId);
      onConfirm({
        imageUrl: composed,
        musicTrack: isStory ? musicTrack : null,
        taggedUsers: isStory ? taggedUsers : [],
        link: isStory ? resolvedLink : null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la composition');
    } finally {
      setComposing(false);
    }
  }, [
    imageUrl,
    overlays,
    filterId,
    musicTrack,
    taggedUsers,
    link,
    linkUrlInput,
    linkLabelInput,
    onConfirm,
    isStory,
    isFeed,
  ]);

  const hasStoryMeta = isStory && Boolean(musicTrack || link?.url.trim());

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
          onClick={() => {
            if (tab !== 'rogner') setTab(null);
          }}
        >
          <div
            ref={previewRef}
            className={`relative h-full w-auto max-w-full ${previewAspect} touch-none select-none overflow-hidden rounded-xl bg-black shadow-[0_0_40px_rgba(0,0,0,0.5)]`}
            onPointerMove={isCropping ? undefined : onPreviewPointerMove}
            onPointerUp={isCropping ? undefined : onPreviewPointerUp}
            onPointerCancel={isCropping ? undefined : onPreviewPointerUp}
            onPointerDown={isCropping ? undefined : onPreviewTap}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={imageUrl}
              alt=""
              className={`w-full h-full object-cover pointer-events-none ${isCropping ? 'opacity-0' : ''}`}
              style={{ filter: filterCss }}
              draggable={false}
            />
            {isCropping && cropSource ? (
              <PhotoInlineCrop
                source={cropSource}
                aspect={cropAspect}
                filterCss={filterCss}
                onApply={handleCropApplied}
                onControlsChange={setCropControls}
              />
            ) : null}
            {!isCropping && isStory
              ? taggedUsers.map((t, index) => {
                  const isActive = activeTagId === t.id;
                  const pos = resolveStoryTagPosition(t, index, taggedUsers.length);
                  return (
                    <div
                      key={t.id}
                      className={`absolute cursor-grab active:cursor-grabbing z-[2] ${
                        isActive ? 'z-10' : ''
                      }`}
                      style={tagPreviewStyle(pos.x, pos.y, isActive)}
                      onPointerDown={(e) => onTagPointerDown(e, t.id)}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="inline-flex items-center rounded-md bg-white/92 px-2.5 py-1 text-[11px] font-semibold text-[#111111] shadow-[0_1px_6px_rgba(0,0,0,0.35)] whitespace-nowrap max-w-[min(72vw,220px)] truncate">
                        @{t.username}
                      </span>
                    </div>
                  );
                })
              : null}
            {!isCropping
              ? overlays.map((o) => {
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
            })
              : null}
            {!isCropping && isStory && link ? (
              <StoryLinkOverlay
                link={link}
                isActive={tab === 'lien'}
                interactive="drag"
                onPointerDown={onLinkPointerDown}
              />
            ) : null}
          </div>

          {hasStoryMeta ? (
            <div className="absolute bottom-2 inset-x-4 flex flex-wrap justify-center gap-2 pointer-events-none z-10">
              {musicTrack ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-black/55 backdrop-blur-sm border border-[#2d2d3d] px-3 py-1.5 text-[11px] text-white/90 max-w-[85vw] truncate">
                  <IconMusic />
                  <span className="truncate">{musicTrack.title}</span>
                </span>
              ) : null}
              {link?.url.trim() ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-black/55 backdrop-blur-sm border border-[#2d2d3d] px-3 py-1.5 text-[11px] text-white/90 max-w-[85vw] truncate">
                  <IconLink />
                  <span className="truncate">Lien ajouté</span>
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

                <div>
                  <span className="text-[10px] text-gray-500 uppercase tracking-wide">Typographie</span>
                  <div className="flex gap-2 overflow-x-auto pb-1 mt-1.5 -mx-0.5 px-0.5">
                    {STORY_TEXT_FONTS.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => updateOverlay(activeOverlay.id, { fontId: f.id })}
                        style={{ fontFamily: f.fontFamily, fontWeight: f.fontWeight }}
                        className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] transition ${
                          (activeOverlay.fontId ?? DEFAULT_STORY_TEXT_FONT_ID) === f.id
                            ? 'bg-purple-600 text-white'
                            : 'bg-[#0b0b0f] text-gray-300 border border-[#2d2d3d] hover:text-white hover:border-purple-500/40'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
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

          {tab === 'rogner' ? (
            <ToolSheet title="Rogner" onClose={closePanel}>
              <p className="text-[11px] text-gray-400 text-center mb-3">
                Glissez la photo ou tirez les coins pour ajuster le cadrage
              </p>
              {cropControls ? (
                <label className="block mb-3">
                  <span className="text-xs text-gray-400">Zoom</span>
                  <input
                    type="range"
                    min={cropControls.minScale}
                    max={cropControls.maxScale}
                    step={0.01}
                    value={cropControls.scale}
                    onChange={(e) => cropControls.setScale(Number(e.target.value))}
                    className="w-full mt-1 accent-purple-500"
                  />
                </label>
              ) : (
                <p className="text-center text-gray-500 text-xs py-2 mb-3">Chargement…</p>
              )}
              <button
                type="button"
                onClick={() => cropControls?.apply()}
                disabled={!cropControls || cropControls.exporting}
                className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-sm disabled:opacity-50"
              >
                {cropControls?.exporting ? '…' : 'Appliquer le rognage'}
              </button>
            </ToolSheet>
          ) : null}

          {tab === 'filtre' ? (
            <ToolSheet title="Filtres" onClose={closePanel}>
              <div className="space-y-3">
                <section>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2 px-0.5">
                    Classiques
                  </p>
                  <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1">
                    {PHOTO_CLASSIC_FILTERS.map((f) => (
                      <FilterThumb
                        key={f.id}
                        preset={f}
                        imageUrl={imageUrl}
                        selected={filterId === f.id}
                        onSelect={() => setFilterId(f.id)}
                      />
                    ))}
                  </div>
                </section>
                <section>
                  <div className="flex items-baseline justify-between gap-2 mb-2 px-0.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-purple-400/90">
                      IA · libre de droit
                    </p>
                    <span className="text-[9px] text-gray-500 shrink-0">100 % local</span>
                  </div>
                  <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1">
                    {PHOTO_AI_FILTERS.map((f) => (
                      <FilterThumb
                        key={f.id}
                        preset={f}
                        imageUrl={imageUrl}
                        selected={filterId === f.id}
                        onSelect={() => setFilterId(f.id)}
                      />
                    ))}
                  </div>
                </section>
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
              <p className="text-[10px] text-gray-500 mb-2">
                Glissez un tag sur la photo ou touchez l&apos;image pour le repositionner.
              </p>
              <StoryUserTagPicker
                token={token}
                tagged={taggedUsers}
                activeTagId={activeTagId}
                onActiveTagChange={setActiveTagId}
                onChange={handleTaggedUsersChange}
              />
            </ToolSheet>
          ) : null}

          {tab === 'lien' && isStory ? (
            <ToolSheet title="Lien" onClose={closePanel}>
              <div className="space-y-3">
                <p className="text-[10px] text-gray-500">
                  Ajoutez un lien cliquable sur la story. Glissez le sticker pour le repositionner.
                </p>
                <label className="block">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wide">Adresse web</span>
                  <input
                    type="url"
                    inputMode="url"
                    value={linkUrlInput}
                    onChange={(e) => applyLinkUrl(e.target.value)}
                    placeholder="https://exemple.com"
                    autoFocus
                    className={`mt-1.5 w-full rounded-xl bg-[#0b0b0f] border px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none ${
                      linkUrlError
                        ? 'border-red-500/70 focus:border-red-500'
                        : 'border-[#2d2d3d] focus:border-purple-500/60'
                    }`}
                  />
                  {linkUrlError ? (
                    <p className="mt-1 text-[10px] text-red-400">{linkUrlError}</p>
                  ) : (
                    <p className="mt-1 text-[10px] text-gray-500">http:// ou https:// uniquement</p>
                  )}
                </label>
                <label className="block">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wide">
                    Texte affiché (optionnel)
                  </span>
                  <input
                    type="text"
                    value={linkLabelInput}
                    onChange={(e) => applyLinkLabel(e.target.value)}
                    placeholder="Voir plus"
                    maxLength={80}
                    className="mt-1.5 w-full rounded-xl bg-[#0b0b0f] border border-[#2d2d3d] px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:border-purple-500/60 focus:outline-none"
                  />
                  <p className="mt-1 text-[10px] text-gray-500">
                    Par défaut : nom de domaine ou « Voir plus »
                  </p>
                </label>
                {link ? (
                  <button
                    type="button"
                    onClick={removeLink}
                    className="w-full py-2 rounded-xl text-[11px] text-red-400 hover:bg-red-500/10 border border-red-500/20"
                  >
                    Supprimer le lien
                  </button>
                ) : null}
              </div>
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
            <DockTool label="Rogner" active={tab === 'rogner'} onClick={openCrop}>
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
                <DockTool label="Lien" active={tab === 'lien'} onClick={handleLinkTool}>
                  <IconLink />
                </DockTool>
              </>
            ) : null}
          </nav>
        </div>
      </div>
    </>
  );
}
