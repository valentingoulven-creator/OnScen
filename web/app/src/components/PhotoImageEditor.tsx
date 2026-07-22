import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useVisualViewportInset } from '../hooks/useVisualViewportInset';
import {
  PHOTO_AI_FILTERS,
  PHOTO_ATYPICAL_FILTERS,
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
import { createBeatPulseVideoFromImage } from '../lib/storyBeatPulse';
import {
  DUOTONE_GENRE_PRESETS,
  STORY_CREATIVE_EFFECTS,
  waveformSeedFromText,
  type StoryCreativeEffectId,
} from '../lib/storyCreativeEffects';
import { createVinylSpinVideoFromImage } from '../lib/storyVinylSpin';
import {
  DEFAULT_STORY_TEXT_FONT_ID,
  resolveStoryTextFont,
  STORY_TEXT_FONTS,
} from '../lib/storyTextFonts';
import {
  DEFAULT_STORY_LINK_POSITION,
  validateStoryLinkUrl,
} from '../lib/storyLink';
import type { StoryLink, StoryMusicTrack, StoryTaggedUser, UserSearchHit } from '../types';
import {
  appendOverlayMentionRef,
  collectAllTaggedUserIds,
  countUniqueTaggedUsers,
  filterStickerTagsNotInText,
  insertStoryMention,
  mergeTaggedUsersForExport,
  parseActiveStoryMention,
  syncOverlayMentionRefs,
  type ActiveStoryMention,
  type StoryTextMentionRef,
} from '../lib/storyTextMention';
import {
  clampOverlayScale,
  effectiveTagFontSize,
  effectiveTextFontSize,
  pointerDistance,
  resolveOverlayScale,
  scaleFromCornerDrag,
  scaleFromPinchDistance,
  STORY_OVERLAY_SCALE_MAX,
  STORY_OVERLAY_SCALE_MIN,
  STORY_TAG_BASE_FONT_SIZE,
  STORY_TEXT_FONT_SIZE_MAX,
  STORY_TEXT_FONT_SIZE_MIN,
} from '../lib/storyOverlayTransform';
import { PhotoInlineCrop, type InlineCropControls } from './PhotoInlineCrop';
import type { PhotoCropAspect } from './StoryImageCropModal';
import { StoryLinkOverlay } from './StoryLinkSticker';
import { StoryMentionAutocomplete } from './StoryMentionAutocomplete';
import { StoryCatalogLinkPicker } from './StoryCatalogLinkPicker';
import { StoryMusicPicker } from './StoryMusicPicker';
import { StoryUserTagPicker } from './StoryUserTagPicker';

const TEXT_COLORS = ['#ffffff', '#fbbf24', '#f472b6', '#60a5fa', '#34d399', '#000000'];
const TAP_MOVE_THRESHOLD_PX = 10;
const MAX_STORY_TAGS = 5;

const TEXT_STYLES: { id: StoryTextOverlayStyle; label: string }[] = [
  { id: 'plain', label: 'Classique' },
  { id: 'background', label: 'Fond' },
  { id: 'outline', label: 'Contour' },
];

export type PhotoEditorMode = 'story' | 'profile' | 'feed';

export interface PhotoEditorResult {
  imageUrl: string;
  videoUrl?: string;
  videoDurationSec?: number;
  musicTrack: StoryMusicTrack | null;
  taggedUsers: StoryTaggedUser[];
  link: StoryLink | null;
  storyEffect?: StoryCreativeEffectId;
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

type EditorTab = 'texte' | 'rogner' | 'filtre' | 'effets' | 'musique' | 'taguer' | 'lien';

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
  const fontSize = effectiveTextFontSize(o);
  const base: React.CSSProperties = {
    left: `${o.x * 100}%`,
    top: `${o.y * 100}%`,
    transform: 'translate(-50%, -50%)',
    fontSize,
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

function ScaleHandle({
  onPointerDown,
  pointerHandlers,
}: {
  onPointerDown: (e: React.PointerEvent) => void;
  pointerHandlers: {
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
    onPointerCancel: (e: React.PointerEvent) => void;
  };
}) {
  return (
    <span
      role="presentation"
      aria-hidden
      data-scale-handle
      className="absolute -bottom-2 -right-2 z-20 h-4 w-4 cursor-se-resize touch-none rounded-full border-2 border-white bg-purple-500 shadow-md"
      onPointerDown={onPointerDown}
      {...pointerHandlers}
    />
  );
}

function renderTextWithMentions(
  text: string,
  mentionRefs: StoryTextMentionRef[] | undefined
): ReactNode {
  const synced = syncOverlayMentionRefs(text, mentionRefs);
  if (!synced.length) return text;

  const known = new Map(synced.map((r) => [r.username.toLowerCase(), r.username]));
  const re = /(^|[\s])(@\w+(?:\.\w+)*)/g;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const prefix = match[1];
    const mention = match[2];
    const username = mention.slice(1);
    const start = match.index + prefix.length;
    if (start > lastIndex) {
      parts.push(text.slice(lastIndex, start));
    }
    if (known.has(username.toLowerCase())) {
      parts.push(
        <strong key={`${start}-${username}`} className="font-extrabold">
          {mention}
        </strong>
      );
    } else {
      parts.push(mention);
    }
    lastIndex = start + mention.length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts.length ? parts : text;
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
      className={`flex flex-col items-center gap-1 min-w-[56px] min-h-11 py-1 transition-colors ${
        active ? 'text-purple-300' : 'text-gray-300 hover:text-white'
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

function StorySidebarTool({
  label,
  active,
  onClick,
  badge,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  badge?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex items-center justify-center w-12 h-12 rounded-2xl shadow-lg transition-all duration-150 active:scale-90 ${
        active
          ? 'bg-white/25 ring-2 ring-white/55 text-white'
          : 'bg-black/45 backdrop-blur-md text-white/80 hover:text-white hover:bg-black/60'
      }`}
      aria-label={label}
      aria-pressed={active}
    >
      {children}
      {badge && !active ? (
        <span
          className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-purple-500 rounded-full border-2 border-black/80"
          aria-hidden
        />
      ) : null}
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

function IconEffects() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3l1.4 4.3L18 9l-4.6 1.7L12 15l-1.4-4.3L6 9l4.6-1.7L12 3z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M19 14l.8 2.4L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.6L19 14z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WaveformPreviewBars({ seed }: { seed: string }) {
  const bars = Array.from({ length: 28 }, (_, i) => {
    let h = 2166136261 ^ (seed.charCodeAt(i % seed.length) || 0);
    h = Math.imul(h ^ i, 16777619);
    return 18 + (h % 62);
  });
  return (
    <div
      className="absolute inset-x-0 bottom-0 z-[4] flex items-end justify-center gap-[3px] px-4 pb-6 pt-16 pointer-events-none"
      aria-hidden
    >
      <div className="flex items-end justify-center gap-[3px] w-full max-w-md h-14 opacity-90">
        {bars.map((pct, i) => (
          <span
            key={i}
            className="flex-1 max-w-[6px] rounded-full bg-gradient-to-t from-fuchsia-500 to-purple-400"
            style={{ height: `${pct}%` }}
          />
        ))}
      </div>
    </div>
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
      className={`shrink-0 snap-center flex flex-col items-center gap-1.5 transition ${
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
  variant = 'card',
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  variant?: 'card' | 'sheet';
}) {
  return (
    <div
      className={
        variant === 'sheet'
          ? 'mx-0 mb-0 rounded-t-2xl border border-[#2d2d3d] border-b-0 bg-[#12121a]/98 backdrop-blur-xl shadow-2xl pointer-events-auto'
          : 'mx-2 mb-2 rounded-2xl border border-[#2d2d3d] bg-[#12121a]/98 backdrop-blur-xl shadow-2xl pointer-events-auto'
      }
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
      <div className="p-3 max-h-[42dvh] overflow-y-auto">{children}</div>
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
    ? 'absolute inset-0 w-full h-full touch-none select-none overflow-hidden'
    : isFeed
      ? 'aspect-[4/5] h-full max-h-full w-auto max-w-[min(100%,28rem)]'
      : 'aspect-square h-full max-h-full w-auto max-w-[min(100%,28rem)]';

  const [imageUrl, setImageUrl] = useState(initialImage);
  const [cropSource, setCropSource] = useState<File | string | null>(null);
  const cropControlsRef = useRef<InlineCropControls | null>(null);
  const pendingTabRef = useRef<EditorTab | null | undefined>(undefined);
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
  const [linkMode, setLinkMode] = useState<'web' | 'catalog'>('web');
  const [storyEffectId, setStoryEffectId] = useState<StoryCreativeEffectId>('none');
  const [duotoneGenreId, setDuotoneGenreId] = useState('default');
  const [tab, setTab] = useState<EditorTab | null>(null);
  const [overlayHistory, setOverlayHistory] = useState<StoryTextOverlay[][]>([]);
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
  const pendingTextDragRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
  } | null>(null);
  const previewTapRef = useRef<{ x: number; y: number } | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const scalePointersRef = useRef(new Map<number, { x: number; y: number }>());
  const scalePinchRef = useRef<{
    distance: number;
    baseScale: number;
    kind: 'text' | 'tag';
    id: string;
  } | null>(null);
  const scaleCornerRef = useRef<{
    startDistance: number;
    baseScale: number;
    centerX: number;
    centerY: number;
    kind: 'text' | 'tag';
    id: string;
  } | null>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const sheetTextInputRef = useRef<HTMLInputElement>(null);
  const [inlineEditing, setInlineEditing] = useState(false);
  const [isScaling, setIsScaling] = useState(false);
  const [activeMention, setActiveMention] = useState<ActiveStoryMention | null>(null);
  const keyboardInset = useVisualViewportInset();
  const keyboardOpen = keyboardInset > 80;

  const clearCropState = () => {
    setCropSource(null);
    cropControlsRef.current = null;
  };

  const snapshotOverlays = (current: StoryTextOverlay[]) => {
    setOverlayHistory((prev) => [...prev.slice(-9), current]);
  };

  const undoOverlay = () => {
    setOverlayHistory((prev) => {
      if (!prev.length) return prev;
      const snapshot = prev[prev.length - 1];
      setOverlays(snapshot);
      setActiveOverlayId(
        snapshot.length > 0 ? snapshot[snapshot.length - 1].id : null
      );
      if (snapshot.length === 0) setTab((t) => (t === 'texte' ? null : t));
      return prev.slice(0, -1);
    });
  };

  const leaveRognerIfNeeded = (nextTab: EditorTab | null): boolean => {
    if (tab !== 'rogner' || !cropSource) return false;
    const controls = cropControlsRef.current;
    if (controls && !controls.exporting) {
      pendingTabRef.current = nextTab;
      controls.apply();
      return true;
    }
    clearCropState();
    return false;
  };

  const activeOverlay = overlays.find((o) => o.id === activeOverlayId) ?? null;
  const activeTag = taggedUsers.find((t) => t.id === activeTagId) ?? null;
  const filterCss = getPhotoFilterCss(filterId);

  const updateOverlay = (id: string, patch: Partial<StoryTextOverlay>) => {
    setOverlays((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  };

  const createTextOverlayAt = (x = 0.5, y = 0.42): string => {
    snapshotOverlays(overlays);
    const id = newOverlayId();
    setOverlays((prev) => [
      ...prev,
      {
        id,
        text: '',
        x,
        y,
        color: '#ffffff',
        fontSize: 28,
        style: 'plain',
        fontId: DEFAULT_STORY_TEXT_FONT_ID,
      },
    ]);
    setActiveOverlayId(id);
    setInlineEditing(true);
    setActiveMention(null);
    return id;
  };

  const createTextOverlay = (): string => createTextOverlayAt(0.5, 0.42);

  const focusTextInput = () => {
    window.requestAnimationFrame(() => {
      const el = textInputRef.current ?? sheetTextInputRef.current;
      el?.focus();
    });
  };

  useEffect(() => {
    if (inlineEditing && activeOverlayId) focusTextInput();
  }, [inlineEditing, activeOverlayId]);

  useEffect(() => {
    if (!keyboardOpen || tab !== 'texte') return;
    const el = sheetTextInputRef.current ?? textInputRef.current;
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [keyboardOpen, keyboardInset, tab]);

  const syncMentionFromInput = (text: string, cursor: number) => {
    setActiveMention(parseActiveStoryMention(text, cursor));
  };

  const handleOverlayTextChange = (id: string, raw: string, cursor: number) => {
    setOverlays((prev) =>
      prev.map((o) =>
        o.id === id
          ? {
              ...o,
              text: raw,
              mentionRefs: syncOverlayMentionRefs(raw, o.mentionRefs),
            }
          : o
      )
    );
    syncMentionFromInput(raw, cursor);
  };

  const handleTextTool = () => {
    if (tab === 'texte') {
      setTab(null);
      return;
    }
    if (leaveRognerIfNeeded('texte')) return;
    if (tab !== 'rogner') clearCropState();
    if (!activeOverlayId) {
      if (overlays.length === 0) {
        createTextOverlay();
      } else {
        setActiveOverlayId(overlays[overlays.length - 1].id);
        setInlineEditing(true);
      }
    } else {
      setInlineEditing(true);
    }
    setTab('texte');
    setInlineEditing(true);
  };

  const removeOverlay = (id: string) => {
    snapshotOverlays(overlays);
    setOverlays((prev) => prev.filter((o) => o.id !== id));
    if (activeOverlayId === id) {
      setActiveOverlayId(null);
      if (overlays.length <= 1) setTab(null);
    }
  };

  const onOverlayPointerDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    if ((e.target as HTMLElement).closest('input, [data-scale-handle]')) return;
    const o = overlays.find((x) => x.id === id);
    if (!o) return;
    setActiveOverlayId(id);
    setActiveTagId(null);
    if (leaveRognerIfNeeded('texte')) return;
    setTab('texte');
    setInlineEditing(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    trackScalePointer(e);
    if (scalePointersRef.current.size >= 2) {
      beginScalePinch('text', id, resolveOverlayScale(o.scale));
      return;
    }
    pendingTextDragRef.current = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      baseX: o.x,
      baseY: o.y,
    };
  };

  const onTagPointerDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    if ((e.target as HTMLElement).closest('[data-scale-handle]')) return;
    const tag = taggedUsers.find((t) => t.id === id);
    if (!tag) return;
    const index = taggedUsers.findIndex((t) => t.id === id);
    const pos = resolveStoryTagPosition(tag, index, taggedUsers.length);
    setActiveTagId(id);
    setActiveOverlayId(null);
    if (leaveRognerIfNeeded('taguer')) return;
    setTab('taguer');
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    trackScalePointer(e);
    if (scalePointersRef.current.size >= 2) {
      beginScalePinch('tag', id, resolveOverlayScale(tag.scale));
      return;
    }
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
    if (leaveRognerIfNeeded('lien')) return;
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
    if (leaveRognerIfNeeded('lien')) return;
    if (tab !== 'rogner') clearCropState();
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

  const updateTagScale = (id: string, scale: number) => {
    setTaggedUsers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, scale: clampOverlayScale(scale) } : t))
    );
  };

  const clearScaleGesture = () => {
    scalePointersRef.current.clear();
    scalePinchRef.current = null;
    scaleCornerRef.current = null;
    setIsScaling(false);
  };

  const applyTextScale = (id: string, scale: number) => {
    updateOverlay(id, { scale: clampOverlayScale(scale) });
  };

  const trackScalePointer = (e: React.PointerEvent) => {
    scalePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };

  const beginScalePinch = (
    kind: 'text' | 'tag',
    id: string,
    baseScale: number
  ) => {
    const pts = [...scalePointersRef.current.values()];
    if (pts.length < 2) return;
    scalePinchRef.current = {
      distance: pointerDistance(pts[0], pts[1]),
      baseScale,
      kind,
      id,
    };
    scaleCornerRef.current = null;
    dragRef.current = null;
    pendingTextDragRef.current = null;
    setIsScaling(true);
    setInlineEditing(false);
  };

  const syncScalePinch = () => {
    const pinch = scalePinchRef.current;
    if (!pinch) return;
    const pts = [...scalePointersRef.current.values()];
    if (pts.length < 2) return;
    const distance = pointerDistance(pts[0], pts[1]);
    const nextScale = scaleFromPinchDistance(pinch.distance, distance, pinch.baseScale);
    if (pinch.kind === 'text') {
      applyTextScale(pinch.id, nextScale);
    } else {
      updateTagScale(pinch.id, nextScale);
    }
  };

  const onCornerScalePointerDown = (
    e: React.PointerEvent,
    kind: 'text' | 'tag',
    id: string,
    baseScale: number
  ) => {
    e.stopPropagation();
    const host = (e.currentTarget as HTMLElement).offsetParent as HTMLElement | null;
    const rect = host?.getBoundingClientRect();
    if (!rect) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    scaleCornerRef.current = {
      startDistance: Math.hypot(e.clientX - centerX, e.clientY - centerY),
      baseScale,
      centerX,
      centerY,
      kind,
      id,
    };
    scalePinchRef.current = null;
    dragRef.current = null;
    pendingTextDragRef.current = null;
    setIsScaling(true);
    setInlineEditing(false);
  };

  const syncCornerScale = (e: React.PointerEvent) => {
    const corner = scaleCornerRef.current;
    if (!corner) return;
    const distance = Math.hypot(
      e.clientX - corner.centerX,
      e.clientY - corner.centerY
    );
    const nextScale = scaleFromCornerDrag(
      corner.startDistance,
      distance,
      corner.baseScale
    );
    if (corner.kind === 'text') {
      applyTextScale(corner.id, nextScale);
    } else {
      updateTagScale(corner.id, nextScale);
    }
  };

  const previewCoords = (e: React.PointerEvent): { x: number; y: number } | null => {
    if (!previewRef.current) return null;
    const rect = previewRef.current.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  };

  const handlePreviewBackgroundTap = (e: React.PointerEvent) => {
    const coords = previewCoords(e);
    if (!coords) return;

    if (isStory && tab === 'taguer') {
      if (activeTagId) {
        updateTagPosition(activeTagId, coords.x, coords.y);
        return;
      }
      if (taggedUsers.length > 0) {
        const last = taggedUsers[taggedUsers.length - 1];
        setActiveTagId(last.id);
        updateTagPosition(last.id, coords.x, coords.y);
      }
      return;
    }

    if (tab === 'rogner' || tab === 'lien') return;

    if (leaveRognerIfNeeded('texte')) return;
    clearCropState();
    setActiveTagId(null);
    createTextOverlayAt(coords.x, coords.y);
    setTab('texte');
  };

  const onPreviewPointerDown = (e: React.PointerEvent) => {
    const target = e.target as Node;
    const preview = previewRef.current;
    if (!preview) return;
    const bgImg = preview.querySelector('img');
    if (target !== preview && target !== bgImg) return;
    previewTapRef.current = { x: e.clientX, y: e.clientY };
  };

  const onPreviewPointerMove = (e: React.PointerEvent) => {
    if (scalePointersRef.current.has(e.pointerId)) {
      trackScalePointer(e);
      if (scalePointersRef.current.size >= 2) {
        if (!scalePinchRef.current) {
          const activeText = activeOverlayId
            ? overlays.find((o) => o.id === activeOverlayId)
            : null;
          const activeTag = activeTagId
            ? taggedUsers.find((t) => t.id === activeTagId)
            : null;
          if (activeText) {
            beginScalePinch('text', activeText.id, resolveOverlayScale(activeText.scale));
          } else if (activeTag) {
            beginScalePinch('tag', activeTag.id, resolveOverlayScale(activeTag.scale));
          }
        }
        syncScalePinch();
        return;
      }
    }

    if (scaleCornerRef.current) {
      syncCornerScale(e);
      return;
    }

    const pending = pendingTextDragRef.current;
    if (pending && previewRef.current && !isScaling) {
      const moved = Math.hypot(e.clientX - pending.startX, e.clientY - pending.startY);
      if (moved > TAP_MOVE_THRESHOLD_PX) {
        dragRef.current = { kind: 'text', ...pending };
        pendingTextDragRef.current = null;
        setInlineEditing(false);
      }
    }

    const d = dragRef.current;
    if (!d || !previewRef.current || isScaling) return;
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

  const onPreviewPointerUp = (e: React.PointerEvent) => {
    const wasScaling =
      isScaling ||
      Boolean(scalePinchRef.current) ||
      Boolean(scaleCornerRef.current);

    scalePointersRef.current.delete(e.pointerId);
    if (scalePointersRef.current.size < 2) {
      scalePinchRef.current = null;
    }
    if (scaleCornerRef.current) {
      clearScaleGesture();
    } else if (scalePointersRef.current.size === 0) {
      setIsScaling(false);
    }

    const wasDragging = Boolean(dragRef.current);
    dragRef.current = null;
    pendingTextDragRef.current = null;

    const tapStart = previewTapRef.current;
    previewTapRef.current = null;
    if (wasDragging || wasScaling || !tapStart) return;

    const moved = Math.hypot(e.clientX - tapStart.x, e.clientY - tapStart.y);
    if (moved > TAP_MOVE_THRESHOLD_PX) return;

    handlePreviewBackgroundTap(e);
  };

  const overlayPointerHandlers = {
    onPointerMove: onPreviewPointerMove,
    onPointerUp: onPreviewPointerUp,
    onPointerCancel: onPreviewPointerUp,
  };

  const handleTaggedUsersChange = (
    users: StoryTaggedUser[],
    options?: { focusTagTab?: boolean }
  ) => {
    const withPositions = assignDefaultTagPositions(users);
    const added = users.find((u) => !taggedUsers.some((t) => t.id === u.id));
    setTaggedUsers(withPositions);
    const focusTagTab = options?.focusTagTab !== false;
    if (added && focusTagTab) {
      setActiveTagId(added.id);
      if (leaveRognerIfNeeded('taguer')) return;
      setTab('taguer');
    } else if (activeTagId && !withPositions.some((t) => t.id === activeTagId)) {
      setActiveTagId(withPositions.length ? withPositions[withPositions.length - 1].id : null);
    }
  };

  const handleMentionSelect = (hit: UserSearchHit) => {
    if (!activeOverlay || !activeMention) return;
    if (countUniqueTaggedUsers(taggedUsers, overlays) >= MAX_STORY_TAGS) return;
    if (collectAllTaggedUserIds(taggedUsers, overlays).includes(hit.id)) return;

    const { text, cursor } = insertStoryMention(
      activeOverlay.text,
      activeMention.start,
      activeMention.end,
      hit.username
    );
    const mentionRefs = appendOverlayMentionRef(activeOverlay.mentionRefs, {
      id: hit.id,
      username: hit.username,
    });
    updateOverlay(activeOverlay.id, {
      text,
      mentionRefs: syncOverlayMentionRefs(text, mentionRefs),
    });
    setActiveMention(null);
    window.requestAnimationFrame(() => {
      const el = textInputRef.current ?? sheetTextInputRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(cursor, cursor);
      }
    });
  };

  const openCrop = () => {
    if (tab === 'rogner') {
      if (leaveRognerIfNeeded(null)) return;
      setTab(null);
      return;
    }
    setCropSource(initialSource ?? imageUrl);
    setTab('rogner');
  };

  const handleCropApplied = (url: string) => {
    setImageUrl(url);
    clearCropState();
    if (pendingTabRef.current !== undefined) {
      setTab(pendingTabRef.current);
      pendingTabRef.current = undefined;
    } else {
      setTab(null);
    }
  };

  const toggleTab = (next: EditorTab) => {
    const target = tab === next ? null : next;
    if (leaveRognerIfNeeded(target)) return;
    if (target !== 'rogner') clearCropState();
    setTab(target);
  };

  const closePanel = () => {
    if (leaveRognerIfNeeded(null)) return;
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

      let composeUrl = imageUrl;
      if (tab === 'rogner' && cropSource) {
        const applied = cropControlsRef.current?.apply();
        if (applied) composeUrl = applied;
      }

      const stickerTagsForCanvas = isStory
        ? filterStickerTagsNotInText(taggedUsers, overlays)
        : [];
      const exportTaggedUsers = isStory
        ? mergeTaggedUsersForExport(taggedUsers, overlays)
        : [];

      const effectOpts = isStory
        ? {
            storyEffect: storyEffectId,
            duotoneGenre: storyEffectId === 'duotone' ? duotoneGenreId : null,
            waveformSeed:
              storyEffectId === 'waveform'
                ? waveformSeedFromText(musicTrack?.title, musicTrack?.artist)
                : null,
          }
        : undefined;

      const composed = isStory
        ? await composeStoryImageWithOverlays(
            composeUrl,
            overlays,
            filterId,
            stickerTagsForCanvas,
            effectOpts
          )
        : isFeed
          ? await composeFeedImageWithEdits(composeUrl, overlays, filterId)
          : await composeProfileImageWithEdits(composeUrl, overlays, filterId);

      let videoUrl: string | undefined;
      let videoDurationSec: number | undefined;
      let finalImageUrl = composed;

      if (isStory && storyEffectId === 'vinyl') {
        const vinyl = await createVinylSpinVideoFromImage(composed);
        videoUrl = vinyl.videoUrl;
        videoDurationSec = vinyl.durationSec;
        finalImageUrl = vinyl.posterUrl;
      } else if (isStory && storyEffectId === 'pulse') {
        const pulse = await createBeatPulseVideoFromImage(composed);
        videoUrl = pulse.videoUrl;
        videoDurationSec = pulse.durationSec;
        finalImageUrl = pulse.posterUrl;
      }

      onConfirm({
        imageUrl: finalImageUrl,
        videoUrl,
        videoDurationSec,
        musicTrack: isStory ? musicTrack : null,
        taggedUsers: exportTaggedUsers,
        link: isStory ? resolvedLink : null,
        storyEffect: isStory ? storyEffectId : undefined,
      });
    } catch (e) {
      if (e instanceof Error) {
        const msg = e.message;
        setError(
          /Failed to fetch|NetworkError|network error/i.test(msg)
            ? 'Impossible de télécharger la photo. Vérifiez votre connexion.'
            : msg
        );
      } else {
        setError('Erreur lors de la composition');
      }
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
    tab,
    cropSource,
    storyEffectId,
    duotoneGenreId,
  ]);

  const hasStoryMeta = isStory && Boolean(musicTrack || link?.url.trim());

  const storyPreviewEffectClass =
    isStory && storyEffectId === 'pulse'
      ? 'story-effect-pulse'
      : isStory && storyEffectId === 'vinyl'
        ? 'story-effect-vinyl'
        : isStory && storyEffectId === 'glitch'
          ? 'story-effect-glitch'
          : isStory && storyEffectId === 'duotone'
            ? `story-effect-duotone story-duotone-${duotoneGenreId}`
            : '';

  const waveformPreviewSeed = waveformSeedFromText(musicTrack?.title, musicTrack?.artist);

  const editorShellStyle = {
    '--keyboard-inset': `${keyboardInset}px`,
  } as CSSProperties;

  return (
    <>
      <div
        className={`ms-story-editor-shell fixed inset-0 z-[125] overflow-hidden h-dvh max-h-dvh ${
          isStory ? 'bg-black' : 'bg-[#0b0b0f] flex flex-col'
        }`}
        style={editorShellStyle}
      >
        {!isStory ? (
          <header className="relative z-20 flex items-center justify-between px-4 ms-safe-area-top pb-3 bg-gradient-to-b from-[#0b0b0f] via-[#0b0b0f]/90 to-transparent">
            <button
              type="button"
              onClick={onCancel}
              className="text-sm text-gray-300 hover:text-white min-w-[4.5rem] text-left"
            >
              Annuler
            </button>
            <h2 className="text-sm font-semibold text-white tracking-wide">
              {isFeed ? 'Publication' : 'Photo de profil'}
            </h2>
            <button
              type="button"
              onClick={() => void confirm()}
              disabled={composing}
              className="text-sm font-semibold text-purple-400 hover:text-purple-300 disabled:opacity-40 min-w-[4.5rem] text-right"
            >
              {composing ? '…' : 'Utiliser'}
            </button>
          </header>
        ) : null}

        <div
          className={
            isStory
              ? 'absolute inset-0'
              : 'relative flex-1 flex items-center justify-center min-h-0 px-2'
          }
          onClick={() => {
            if (tab !== 'rogner') setTab(null);
          }}
        >
          <div
            ref={previewRef}
            className={`relative ${previewAspect}${storyPreviewEffectClass}${
              isStory
                ? ''
                : ' mx-auto touch-none select-none overflow-hidden rounded-xl bg-black shadow-[0_0_40px_rgba(0,0,0,0.5)]'
            }`}
            onPointerMove={isCropping ? undefined : onPreviewPointerMove}
            onPointerUp={isCropping ? undefined : onPreviewPointerUp}
            onPointerCancel={isCropping ? undefined : onPreviewPointerUp}
            onPointerDown={isCropping ? undefined : onPreviewPointerDown}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={imageUrl}
              alt=""
              className={`absolute inset-0 block h-full w-full object-cover object-center pointer-events-none ${isCropping ? 'opacity-0' : ''}`}
              style={{ filter: filterCss }}
              draggable={false}
            />
            <div className="absolute inset-0">
              {isCropping && cropSource ? (
                <PhotoInlineCrop
                  source={cropSource}
                  aspect={cropAspect}
                  filterCss={filterCss}
                  onApply={handleCropApplied}
                  onControlsChange={(controls) => {
                    cropControlsRef.current = controls;
                  }}
                />
              ) : null}
            </div>
            {!isCropping && isStory
              ? filterStickerTagsNotInText(taggedUsers, overlays).map((t, index, arr) => {
                  const isActive = activeTagId === t.id;
                  const pos = resolveStoryTagPosition(t, index, arr.length);
                  const tagFontSize = effectiveTagFontSize(t);
                  return (
                    <div
                      key={t.id}
                      className={`absolute cursor-grab active:cursor-grabbing z-[2] ${
                        isActive ? 'z-10' : ''
                      }`}
                      style={tagPreviewStyle(pos.x, pos.y, isActive)}
                      onPointerDown={(e) => onTagPointerDown(e, t.id)}
                      onClick={(e) => e.stopPropagation()}
                      {...overlayPointerHandlers}
                    >
                      <span
                        className="inline-flex items-center rounded-md bg-white/92 px-2.5 py-1 font-semibold text-[#111111] shadow-[0_1px_6px_rgba(0,0,0,0.35)] whitespace-nowrap max-w-[min(72vw,220px)] truncate"
                        style={{ fontSize: tagFontSize }}
                      >
                        @{t.username}
                      </span>
                      {isActive ? (
                        <ScaleHandle
                          pointerHandlers={overlayPointerHandlers}
                          onPointerDown={(e) =>
                            onCornerScalePointerDown(
                              e,
                              'tag',
                              t.id,
                              resolveOverlayScale(t.scale)
                            )
                          }
                        />
                      ) : null}
                    </div>
                  );
                })
              : null}
            {!isCropping
              ? overlays.map((o) => {
                  const isActive = activeOverlayId === o.id;
                  const displayText = o.text.trim();
                  const showInlineInput =
                    isActive &&
                    inlineEditing &&
                    tab === 'texte' &&
                    !dragRef.current &&
                    !isScaling;
                  const font = resolveStoryTextFont(o.fontId);
                  const renderedSize = effectiveTextFontSize(o);
                  return (
                    <div
                      key={o.id}
                      className={`absolute ${showInlineInput ? 'cursor-text' : 'cursor-grab active:cursor-grabbing'} ${
                        isActive ? 'z-10' : 'z-[1]'
                      }`}
                      style={overlayPreviewStyle(o, isActive && !showInlineInput)}
                      onPointerDown={(e) => onOverlayPointerDown(e, o.id)}
                      onClick={(e) => e.stopPropagation()}
                      {...overlayPointerHandlers}
                    >
                      {showInlineInput ? (
                        <input
                          ref={textInputRef}
                          type="text"
                          value={o.text}
                          onChange={(e) =>
                            handleOverlayTextChange(
                              o.id,
                              e.target.value,
                              e.target.selectionStart ?? e.target.value.length
                            )
                          }
                          onSelect={(e) => {
                            const el = e.currentTarget;
                            syncMentionFromInput(
                              el.value,
                              el.selectionStart ?? el.value.length
                            );
                          }}
                          onKeyUp={(e) => {
                            const el = e.currentTarget;
                            syncMentionFromInput(
                              el.value,
                              el.selectionStart ?? el.value.length
                            );
                          }}
                          onPointerDown={(e) => e.stopPropagation()}
                          placeholder="Tapez…"
                          className="bg-transparent border-none outline-none text-center min-w-[3rem] max-w-[min(72vw,280px)] placeholder:text-white/45 placeholder:italic"
                          style={{
                            fontSize: renderedSize,
                            fontFamily: font.fontFamily,
                            fontWeight: font.fontWeight,
                            color:
                              (o.style ?? 'plain') === 'background'
                                ? '#111111'
                                : (o.style ?? 'plain') === 'outline'
                                  ? '#ffffff'
                                  : o.color,
                            WebkitTextStroke:
                              (o.style ?? 'plain') === 'outline'
                                ? `1.5px ${o.color}`
                                : undefined,
                          }}
                        />
                      ) : displayText ? (
                        renderTextWithMentions(displayText, o.mentionRefs)
                      ) : isActive ? (
                        <span className="text-white/45 italic text-[0.85em] font-medium">
                          Tapez…
                        </span>
                      ) : null}
                      {isActive && !showInlineInput ? (
                        <ScaleHandle
                          pointerHandlers={overlayPointerHandlers}
                          onPointerDown={(e) =>
                            onCornerScalePointerDown(
                              e,
                              'text',
                              o.id,
                              resolveOverlayScale(o.scale)
                            )
                          }
                        />
                      ) : null}
                    </div>
                  );
                })
              : null}
            {!isCropping && isStory && storyEffectId === 'waveform' ? (
              <WaveformPreviewBars seed={waveformPreviewSeed} />
            ) : null}
            {!isCropping && isStory && link ? (
              <StoryLinkOverlay
                link={link}
                isActive={tab === 'lien'}
                interactive="drag"
                onPointerDown={onLinkPointerDown}
              />
            ) : null}

            {isStory ? (
              <div className="absolute inset-x-0 top-0 z-30 pointer-events-none">
                <div className="pointer-events-auto flex items-center justify-between px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={onCancel}
                      className="min-h-11 min-w-11 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-md text-white"
                      aria-label="Annuler"
                    >
                      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                    {overlayHistory.length > 0 ? (
                      <button
                        type="button"
                        onClick={undoOverlay}
                        className="min-h-9 min-w-9 flex items-center justify-center rounded-full bg-black/35 backdrop-blur-md text-white/80 hover:text-white transition-opacity"
                        aria-label="Annuler la dernière action"
                      >
                        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 14L4 9l5-5M4 9h10a7 7 0 0 1 0 14H9" />
                        </svg>
                      </button>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => void confirm()}
                    disabled={composing}
                    className="min-h-11 px-5 flex items-center justify-center rounded-full bg-white text-black text-sm font-bold disabled:opacity-40 shadow-lg"
                  >
                    {composing ? '…' : 'Suivant →'}
                  </button>
                </div>
              </div>
            ) : null}

            {isStory && !isCropping ? (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-3">
                <StorySidebarTool label="Texte" active={tab === 'texte'} onClick={handleTextTool}>
                  <IconText />
                </StorySidebarTool>
                <StorySidebarTool label="Rogner" active={tab === 'rogner'} onClick={openCrop}>
                  <IconCrop />
                </StorySidebarTool>
                <StorySidebarTool
                  label="Filtre"
                  active={tab === 'filtre'}
                  badge={filterId !== 'none'}
                  onClick={() => toggleTab('filtre')}
                >
                  <IconFilter />
                </StorySidebarTool>
                <StorySidebarTool
                  label="Effets"
                  active={tab === 'effets'}
                  badge={storyEffectId !== 'none'}
                  onClick={() => toggleTab('effets')}
                >
                  <IconEffects />
                </StorySidebarTool>
                <StorySidebarTool
                  label="Musique"
                  active={tab === 'musique'}
                  badge={Boolean(musicTrack)}
                  onClick={() => toggleTab('musique')}
                >
                  <IconMusic />
                </StorySidebarTool>
                <StorySidebarTool
                  label="Taguer"
                  active={tab === 'taguer'}
                  badge={taggedUsers.length > 0}
                  onClick={() => toggleTab('taguer')}
                >
                  <IconTag />
                </StorySidebarTool>
                <StorySidebarTool
                  label="Lien"
                  active={tab === 'lien'}
                  badge={Boolean(link?.url?.trim())}
                  onClick={handleLinkTool}
                >
                  <IconLink />
                </StorySidebarTool>
              </div>
            ) : null}

            {isStory && musicTrack && tab !== 'musique' && !isCropping ? (
              <div className="absolute bottom-8 inset-x-0 z-[5] flex justify-center pointer-events-none">
                <div className="flex items-center gap-1.5 rounded-full bg-black/55 backdrop-blur-sm border border-white/10 px-3 py-1.5 max-w-[60vw]">
                  <IconMusic />
                  <span className="text-[11px] text-white/90 truncate">{musicTrack.title}</span>
                  {musicTrack.artist ? (
                    <span className="text-[10px] text-white/50 truncate ml-0.5">— {musicTrack.artist}</span>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          {!isStory && hasStoryMeta ? (
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

        {/* Tool panels + dock (feed/profile) */}
        <div
          className={
            isStory
              ? 'absolute inset-x-0 bottom-0 z-40 pointer-events-none ms-story-editor-dock pb-[max(0.5rem,env(safe-area-inset-bottom))]'
              : 'ms-story-editor-dock relative z-20 shrink-0 ms-safe-area-bottom pb-[max(0.5rem,env(safe-area-inset-bottom))]'
          }
        >
          {tab === 'texte' && activeMention && isStory ? (
            <StoryMentionAutocomplete
              token={token}
              query={activeMention.query}
              excludeIds={collectAllTaggedUserIds(taggedUsers, overlays)}
              currentTagCount={countUniqueTaggedUsers(taggedUsers, overlays)}
              maxTags={MAX_STORY_TAGS}
              onSelect={handleMentionSelect}
              className="mx-2 mb-2 pointer-events-auto"
            />
          ) : null}

          {tab === 'texte' && activeOverlay ? (
            <ToolSheet variant={isStory ? 'sheet' : 'card'} title="Texte" onClose={closePanel}>
              <div className="space-y-3">
                <p className="text-[10px] text-gray-500">
                  Touchez la photo pour placer un texte. Glissez pour déplacer, pincez ou
                  tirez la poignée pour redimensionner ({STORY_OVERLAY_SCALE_MIN}×–
                  {STORY_OVERLAY_SCALE_MAX}×). Tapez @ pour taguer une personne.
                </p>
                <input
                  ref={sheetTextInputRef}
                  type="text"
                  value={activeOverlay.text}
                  onChange={(e) =>
                    handleOverlayTextChange(
                      activeOverlay.id,
                      e.target.value,
                      e.target.selectionStart ?? e.target.value.length
                    )
                  }
                  onSelect={(e) => {
                    const el = e.currentTarget;
                    syncMentionFromInput(el.value, el.selectionStart ?? el.value.length);
                  }}
                  onKeyUp={(e) => {
                    const el = e.currentTarget;
                    syncMentionFromInput(el.value, el.selectionStart ?? el.value.length);
                  }}
                  onFocus={() => setInlineEditing(true)}
                  placeholder="Écrire sur la photo…"
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
                    min={Math.round(STORY_TEXT_FONT_SIZE_MIN * STORY_OVERLAY_SCALE_MIN)}
                    max={Math.round(STORY_TEXT_FONT_SIZE_MAX * STORY_OVERLAY_SCALE_MAX)}
                    value={effectiveTextFontSize(activeOverlay)}
                    onChange={(e) => {
                      const effective = Number(e.target.value);
                      const ratio = effective / activeOverlay.fontSize;
                      updateOverlay(activeOverlay.id, {
                        scale: clampOverlayScale(ratio),
                      });
                    }}
                    className="flex-1 accent-purple-500"
                  />
                  <span className="text-[10px] text-gray-400 w-6 text-right">
                    {effectiveTextFontSize(activeOverlay)}
                  </span>
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
            isStory ? (
              <div
                className="mx-0 mb-0 pointer-events-auto bg-gradient-to-t from-black/95 via-black/80 to-transparent pb-[max(0.75rem,env(safe-area-inset-bottom))]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-4 pt-3 pb-2">
                  <span className="text-[11px] font-semibold text-white/55 uppercase tracking-wider">Filtres</span>
                  <button
                    type="button"
                    onClick={closePanel}
                    className="p-1.5 rounded-lg text-gray-500 hover:text-white"
                    aria-label="Fermer"
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
                <div className="flex gap-3 overflow-x-auto px-4 pb-2 snap-x snap-mandatory touch-pan-x">
                  {[
                    ...PHOTO_CLASSIC_FILTERS,
                    ...PHOTO_AI_FILTERS.filter((f) => f.id !== 'none'),
                    ...PHOTO_ATYPICAL_FILTERS.filter((f) => f.id !== 'none'),
                  ].map((f) => (
                    <FilterThumb
                      key={f.id}
                      preset={f}
                      imageUrl={imageUrl}
                      selected={filterId === f.id}
                      onSelect={() => setFilterId(f.id)}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <ToolSheet variant="card" title="Filtres" onClose={closePanel}>
                <div className="space-y-3">
                  <section>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2 px-0.5">
                      Classiques
                    </p>
                    <div className="flex gap-2.5 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-1 -mx-1 px-1 touch-pan-x">
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
                      <span className="text-[9px] text-gray-500 shrink-0">Aperçu sur votre photo</span>
                    </div>
                    <div className="flex gap-2.5 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-1 -mx-1 px-1 touch-pan-x">
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
            )
          ) : null}

          {tab === 'effets' && isStory ? (
            <ToolSheet variant="sheet" title="Effets Creator" onClose={closePanel}>
              <div className="space-y-3">
                <p className="text-[10px] text-gray-500">
                  Effets libres de droit pour teasers, covers et annonces de sortie.
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {STORY_CREATIVE_EFFECTS.filter((e) => e.id !== 'none').map((effect) => (
                    <button
                      key={effect.id}
                      type="button"
                      onClick={() => setStoryEffectId(effect.id)}
                      className={`min-h-16 rounded-xl border px-2 py-2 text-[10px] font-semibold transition ${
                        storyEffectId === effect.id
                          ? 'border-purple-500 bg-purple-600/20 text-white'
                          : 'border-[#2d2d3d] bg-[#0b0b0f] text-gray-400 hover:border-purple-500/40'
                      }`}
                    >
                      <span className="block text-lg mb-1" aria-hidden>
                        {effect.id === 'glitch'
                          ? '⚡'
                          : effect.id === 'duotone'
                            ? '🎨'
                            : effect.id === 'vinyl'
                              ? '💿'
                              : effect.id === 'pulse'
                                ? '💓'
                                : '〰️'}
                      </span>
                      {effect.label}
                      {effect.exportsVideo ? (
                        <span className="block text-[8px] text-purple-300/80 mt-0.5">Vidéo</span>
                      ) : null}
                    </button>
                  ))}
                </div>
                {storyEffectId === 'duotone' ? (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
                      Genre duotone
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {DUOTONE_GENRE_PRESETS.map((g) => (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => setDuotoneGenreId(g.id)}
                          className={`min-h-9 px-3 rounded-full text-[10px] font-medium border transition ${
                            duotoneGenreId === g.id
                              ? 'border-white text-white'
                              : 'border-[#2d2d3d] text-gray-400'
                          }`}
                          style={{
                            background:
                              duotoneGenreId === g.id
                                ? `linear-gradient(135deg, ${g.shadow}, ${g.highlight})`
                                : undefined,
                          }}
                        >
                          {g.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                {storyEffectId !== 'none' ? (
                  <button
                    type="button"
                    onClick={() => setStoryEffectId('none')}
                    className="w-full py-2 rounded-xl text-[11px] text-gray-400 border border-[#2d2d3d] hover:text-white"
                  >
                    Retirer l&apos;effet
                  </button>
                ) : null}
              </div>
            </ToolSheet>
          ) : null}

          {tab === 'musique' && isStory ? (
            <ToolSheet variant={isStory ? 'sheet' : 'card'} title="Musique" onClose={closePanel}>
              <StoryMusicPicker token={token} value={musicTrack} onChange={setMusicTrack} />
            </ToolSheet>
          ) : null}

          {tab === 'taguer' && isStory ? (
            <ToolSheet variant={isStory ? 'sheet' : 'card'} title="Taguer" onClose={closePanel}>
              <p className="text-[10px] text-gray-500 mb-2">
                Sticker @ séparé : glissez, pincez ou redimensionnez ({STORY_OVERLAY_SCALE_MIN}×–
                {STORY_OVERLAY_SCALE_MAX}×). Pour taguer dans le texte, tapez @ dans un calque
                Texte — pas de pastille en double.
              </p>
              {activeTag ? (
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wide shrink-0">
                    Taille @{activeTag.username}
                  </span>
                  <input
                    type="range"
                    min={Math.round(STORY_TAG_BASE_FONT_SIZE * STORY_OVERLAY_SCALE_MIN)}
                    max={Math.round(STORY_TAG_BASE_FONT_SIZE * STORY_OVERLAY_SCALE_MAX)}
                    value={effectiveTagFontSize(activeTag)}
                    onChange={(e) => {
                      const effective = Number(e.target.value);
                      const ratio = effective / STORY_TAG_BASE_FONT_SIZE;
                      updateTagScale(activeTag.id, ratio);
                    }}
                    className="flex-1 accent-purple-500"
                  />
                  <span className="text-[10px] text-gray-400 w-6 text-right">
                    {effectiveTagFontSize(activeTag)}
                  </span>
                </div>
              ) : null}
              <StoryUserTagPicker
                token={token}
                tagged={taggedUsers}
                activeTagId={activeTagId}
                onActiveTagChange={setActiveTagId}
                onChange={handleTaggedUsersChange}
                totalTagCount={countUniqueTaggedUsers(taggedUsers, overlays)}
                maxTags={MAX_STORY_TAGS}
              />
            </ToolSheet>
          ) : null}

          {tab === 'lien' && isStory ? (
            <ToolSheet variant={isStory ? 'sheet' : 'card'} title="Lien" onClose={closePanel}>
              <div className="space-y-3">
                <div className="flex rounded-full bg-[#0b0b0f] border border-[#2d2d3d] p-1">
                  <button
                    type="button"
                    onClick={() => setLinkMode('web')}
                    className={`flex-1 min-h-9 rounded-full text-[11px] font-semibold ${
                      linkMode === 'web' ? 'bg-purple-600 text-white' : 'text-gray-400'
                    }`}
                  >
                    Web
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLinkMode('catalog');
                      ensureLinkDraft();
                    }}
                    className={`flex-1 min-h-9 rounded-full text-[11px] font-semibold ${
                      linkMode === 'catalog' ? 'bg-purple-600 text-white' : 'text-gray-400'
                    }`}
                  >
                    Album / Son
                  </button>
                </div>
                {linkMode === 'catalog' ? (
                  <StoryCatalogLinkPicker
                    token={token}
                    onSelect={(selection) => {
                      setLinkUrlInput(selection.url);
                      setLinkLabelInput(selection.label);
                      setLinkUrlError(null);
                      setLink({
                        url: selection.url,
                        label: selection.label,
                        x: link?.x ?? DEFAULT_STORY_LINK_POSITION.x,
                        y: link?.y ?? DEFAULT_STORY_LINK_POSITION.y,
                      });
                    }}
                  />
                ) : (
                  <>
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
                  </>
                )}
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

          {error ? (
            <p className={`text-xs text-red-400 pointer-events-auto ${isStory ? 'mx-3 mb-2 text-center' : 'mx-4 mb-2'}`}>
              {error}
            </p>
          ) : null}

          {!isStory ? (
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
          </nav>
          ) : null}
        </div>
      </div>
    </>
  );
}
