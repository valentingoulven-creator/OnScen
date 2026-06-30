import { useCallback, useEffect, useRef, useState } from 'react';

import { useTranslation } from 'react-i18next';

import { useAuth } from '../context/AuthContext';

import { api } from '../lib/api';

import {

  formatDurationSec,

  getAudioDurationSec,

  readFileAsDataUrl,

  validateCompositionFile,

} from '../lib/compositionUpload';

import { ConfirmModal } from './ConfirmModal';

import { ShareLinkMenu } from './ShareLinkMenu';

import { ShareToUserSheet } from './ShareToUserSheet';

import { getAlbumShareUrl } from '../lib/shareLink';



const MAX_FEED_IMAGE_DATA_CHARS = 1_200_000;



function albumCoverForFeed(coverUrl?: string): string | undefined {

  if (!coverUrl?.trim()) return undefined;

  const url = coverUrl.trim();

  if (url.startsWith('https://')) return url;

  if (url.startsWith('data:image/') && url.length <= MAX_FEED_IMAGE_DATA_CHARS) return url;

  return undefined;

}



function ShareIcon({ className }: { className?: string }) {

  return (

    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>

      <path strokeLinecap="round" strokeLinejoin="round" d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />

      <polyline strokeLinecap="round" strokeLinejoin="round" points="16 6 12 2 8 6" />

      <line x1="12" y1="2" x2="12" y2="15" strokeLinecap="round" />

    </svg>

  );

}



function PostIcon({ className }: { className?: string }) {

  return (

    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>

      <path strokeLinecap="round" strokeLinejoin="round" d="M12 20h9" />

      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />

    </svg>

  );

}



export interface UserCompositionItem {

  id: string;

  userId: string;

  albumId?: string;

  title: string;

  artist?: string;

  fileUrl: string;

  durationSec?: number;

  createdAt: number;

  upvoteCount?: number;

  userHasUpvoted?: boolean;

}



export interface UserAlbumItem {

  id: string;

  userId: string;

  title: string;

  description?: string;

  coverUrl?: string;

  trackCount: number;

  createdAt: number;

  updatedAt: number;

}



interface UserCompositionsSectionProps {

  defaultArtist?: string;

  refreshKey?: number;

  /** Profil consulté (défaut : utilisateur connecté). */

  userId?: string;

  /** Vue publique sans actions d'édition. */

  readOnly?: boolean;

}



type PendingUpload = {

  dataUrl: string;

  durationSec?: number;

  fileName: string;

};



type ViewMode = 'grid' | 'album' | 'loose';



const COVER_MAX_BYTES = 3 * 1024 * 1024;

const COVER_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif';



function validateCoverFile(file: File): string | null {

  if (file.size > COVER_MAX_BYTES) return 'Image trop volumineuse (max 3 Mo)';

  if (!file.type.startsWith('image/') && !/\.(jpe?g|png|webp|gif)$/i.test(file.name)) {

    return 'Format non supporté (jpeg, png, webp, gif)';

  }

  return null;

}



function CompositionUpvoteButton({

  track,

  disabled,

  onToggle,

}: {

  track: UserCompositionItem;

  disabled?: boolean;

  onToggle: (compositionId: string) => Promise<void>;

}) {

  const [upvoting, setUpvoting] = useState(false);

  const count = track.upvoteCount ?? 0;

  const hasUpvoted = Boolean(track.userHasUpvoted);



  return (

    <button

      type="button"

      disabled={disabled || upvoting}

      onClick={async () => {

        setUpvoting(true);

        try {

          await onToggle(track.id);

        } finally {

          setUpvoting(false);

        }

      }}

      className={`shrink-0 flex flex-col items-center justify-center min-w-[2rem] px-1 py-0.5 rounded-lg border transition disabled:opacity-50 ${

        hasUpvoted

          ? 'border-amber-400/50 bg-amber-500/15 text-amber-300'

          : 'border-amber-500/20 text-gray-500 hover:border-amber-400/40 hover:text-amber-300 hover:bg-amber-500/10'

      }`}

      aria-pressed={hasUpvoted}

      aria-label={hasUpvoted ? 'Retirer votre vote' : 'Voter pour ce morceau'}

      title={hasUpvoted ? 'Retirer votre vote' : 'Voter pour ce morceau'}

    >

      <span className="text-[10px] leading-none" aria-hidden="true">

        ▲

      </span>

      <span className="text-[10px] font-bold leading-tight tabular-nums">{count}</span>

    </button>

  );

}



export function UserCompositionsSection({

  defaultArtist = '',

  refreshKey = 0,

  userId: userIdProp,

  readOnly = false,

}: UserCompositionsSectionProps) {

  const { user: me, token } = useAuth();

  const { t } = useTranslation();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const coverInputRef = useRef<HTMLInputElement>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);



  const ownerId = userIdProp ?? me?.id ?? '';

  const isOwner = !readOnly && Boolean(me?.id && ownerId === me.id);



  const [albums, setAlbums] = useState<UserAlbumItem[]>([]);

  const [looseTrackCount, setLooseTrackCount] = useState(0);

  const [tracks, setTracks] = useState<UserCompositionItem[]>([]);

  const [loading, setLoading] = useState(true);

  const [tracksLoading, setTracksLoading] = useState(false);

  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  const [selectedAlbum, setSelectedAlbum] = useState<UserAlbumItem | null>(null);



  const [importing, setImporting] = useState(false);

  const [uploading, setUploading] = useState(false);

  const [batchUploadProgress, setBatchUploadProgress] = useState<{ current: number; total: number } | null>(

    null

  );

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [uploadError, setUploadError] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [upvotingId, setUpvotingId] = useState<string | null>(null);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [confirmDeleteAlbumId, setConfirmDeleteAlbumId] = useState<string | null>(null);

  const [deletingAlbumId, setDeletingAlbumId] = useState<string | null>(null);

  const [playingId, setPlayingId] = useState<string | null>(null);

  const [pendingUpload, setPendingUpload] = useState<PendingUpload | null>(null);

  const [uploadTitle, setUploadTitle] = useState('');

  const [uploadArtist, setUploadArtist] = useState(defaultArtist);

  const [uploadRightsConfirmed, setUploadRightsConfirmed] = useState(false);

  const [showCreateAlbum, setShowCreateAlbum] = useState(false);

  const [albumTitle, setAlbumTitle] = useState('');

  const [albumDescription, setAlbumDescription] = useState('');

  const [albumCoverDataUrl, setAlbumCoverDataUrl] = useState<string | null>(null);

  const [albumCoverName, setAlbumCoverName] = useState('');

  const [creatingAlbum, setCreatingAlbum] = useState(false);



  const [shareAlbum, setShareAlbum] = useState<UserAlbumItem | null>(null);

  const [shareAlbumUrl, setShareAlbumUrl] = useState('');

  const [shareToUserOpen, setShareToUserOpen] = useState(false);

  const [postAlbum, setPostAlbum] = useState<UserAlbumItem | null>(null);

  const [postDraft, setPostDraft] = useState('');

  const [postPublishing, setPostPublishing] = useState(false);

  const [postError, setPostError] = useState<string | null>(null);

  const albumDeepLinkHandledRef = useRef(false);

  const trackDeepLinkHandledRef = useRef(false);

  const [createAlbumError, setCreateAlbumError] = useState<string | null>(null);



  useEffect(() => {

    setUploadArtist((a) => a || defaultArtist);

  }, [defaultArtist]);



  useEffect(() => {

    if (!toastMsg) return;

    const id = window.setTimeout(() => setToastMsg(null), 3000);

    return () => window.clearTimeout(id);

  }, [toastMsg]);



  useEffect(() => {

    return () => {

      audioRef.current?.pause();

      audioRef.current = null;

    };

  }, []);



  const loadAlbums = useCallback(() => {

    if (!token || !ownerId) {

      setAlbums([]);

      setLooseTrackCount(0);

      setLoading(false);

      return Promise.resolve();

    }

    setLoading(true);

    const req = isOwner ? api.getMyAlbums(token) : api.getUserAlbums(token, ownerId);

    return req

      .then((r) => {

        setAlbums(r.albums);

        setLooseTrackCount(r.looseTrackCount);

      })

      .catch(() => {

        setAlbums([]);

        setLooseTrackCount(0);

      })

      .finally(() => setLoading(false));

  }, [token, ownerId, isOwner]);



  const loadTracks = useCallback(

    (albumId: string) => {

      if (!token || !ownerId) {

        setTracks([]);

        return Promise.resolve();

      }

      setTracksLoading(true);

      return api

        .getAlbumTracks(token, ownerId, albumId)

        .then((r) => setTracks(r.tracks))

        .catch(() => setTracks([]))

        .finally(() => setTracksLoading(false));

    },

    [token, ownerId]

  );



  useEffect(() => {

    void loadAlbums();

  }, [loadAlbums, refreshKey]);



  useEffect(() => {

    if (viewMode === 'album' && selectedAlbum) {

      void loadTracks(selectedAlbum.id);

    } else if (viewMode === 'loose') {

      void loadTracks('loose');

    } else {

      setTracks([]);

    }

  }, [viewMode, selectedAlbum, loadTracks]);



  const resetUploadForm = () => {

    setPendingUpload(null);

    setUploadTitle('');

    setUploadError(null);

    setUploadRightsConfirmed(false);

  };



  const resetCreateAlbumForm = () => {

    setShowCreateAlbum(false);

    setAlbumTitle('');

    setAlbumDescription('');

    setAlbumCoverDataUrl(null);

    setAlbumCoverName('');

    setCreateAlbumError(null);

  };



  const openFilePicker = () => {

    if (importing || uploading) return;

    fileInputRef.current?.click();

  };



  const showToast = useCallback((msg: string) => {

    setToastMsg(msg);

  }, []);



  const uploadPreparedTrack = async (

    body: {

      title: string;

      artist?: string;

      fileUrl: string;

      durationSec?: number;

      rightsConfirmed?: boolean;

    },

    target?: { albumId: string | null }

  ) => {

    if (!token) throw new Error(t('profile.compositions.uploadFailed'));

    const albumId =

      target !== undefined

        ? target.albumId

        : viewMode === 'album' && selectedAlbum

          ? selectedAlbum.id

          : null;

    if (albumId) {

      await api.uploadTrackToAlbum(token, albumId, body);

    } else {

      await api.uploadLooseTrack(token, body);

    }

  };



  const handleAudioPick = async (file: File) => {

    setUploadError(null);

    const validationError = validateCompositionFile(file);

    if (validationError) {

      setUploadError(validationError);

      return;

    }

    setImporting(true);

    try {

      const dataUrl = await readFileAsDataUrl(file);

      const durationSec = await getAudioDurationSec(dataUrl);

      const baseTitle = file.name.replace(/\.[^.]+$/, '').trim();

      setPendingUpload({ dataUrl, durationSec, fileName: file.name });

      setUploadTitle(baseTitle);

      setUploadArtist((a) => a || defaultArtist);

    } catch (err) {

      setUploadError(err instanceof Error ? err.message : t('profile.compositions.uploadFailed'));

    } finally {

      setImporting(false);

    }

  };



  const handleBatchUpload = async (files: File[]) => {

    if (!token || uploading) return;

    if (!uploadRightsConfirmed) {

      setUploadError(t('profile.compositions.rightsConfirmRequired'));

      return;

    }

    setUploadError(null);

    const validFiles: File[] = [];

    for (const file of files) {

      const validationError = validateCompositionFile(file);

      if (validationError) {

        showToast(t('profile.compositions.uploadBatchSkipped', { name: file.name, reason: validationError }));

        continue;

      }

      validFiles.push(file);

    }

    if (validFiles.length === 0) return;

    const uploadTarget = {

      albumId: viewMode === 'album' && selectedAlbum ? selectedAlbum.id : null,

    };

    setUploading(true);

    setBatchUploadProgress({ current: 0, total: validFiles.length });

    let uploadedCount = 0;

    try {

      for (let i = 0; i < validFiles.length; i++) {

        const file = validFiles[i];

        setBatchUploadProgress({ current: i + 1, total: validFiles.length });

        try {

          const dataUrl = await readFileAsDataUrl(file);

          const durationSec = await getAudioDurationSec(dataUrl);

          const title = file.name.replace(/\.[^.]+$/, '').trim() || file.name;

          await uploadPreparedTrack(

            {

              title,

              artist: uploadArtist.trim() || defaultArtist || undefined,

              fileUrl: dataUrl,

              durationSec,

              rightsConfirmed: true,

            },

            uploadTarget

          );

          uploadedCount += 1;

        } catch (err) {

          const message = err instanceof Error ? err.message : t('profile.compositions.uploadFailed');

          showToast(t('profile.compositions.uploadBatchSkipped', { name: file.name, reason: message }));

        }

      }

      if (uploadedCount > 0) {

        await loadAlbums();

        if (viewMode === 'album' && selectedAlbum) {

          await loadTracks(selectedAlbum.id);

        } else if (viewMode === 'loose') {

          await loadTracks('loose');

        }

        showToast(t('profile.compositions.uploadBatchDone', { count: uploadedCount }));

      }

    } finally {

      setUploading(false);

      setBatchUploadProgress(null);

    }

  };



  const handleAudioFilesPick = (files: File[]) => {

    if (files.length === 0) return;

    if (files.length === 1) {

      void handleAudioPick(files[0]);

      return;

    }

    void handleBatchUpload(files);

  };



  const submitUpload = async (e: React.FormEvent) => {

    e.preventDefault();

    if (!token || !pendingUpload || uploading) return;

    if (!uploadRightsConfirmed) {

      setUploadError(t('profile.compositions.rightsConfirmRequired'));

      return;

    }

    setUploadError(null);

    setUploading(true);

    try {

      const body = {

        title: uploadTitle.trim(),

        artist: uploadArtist.trim() || undefined,

        fileUrl: pendingUpload.dataUrl,

        durationSec: pendingUpload.durationSec,

        rightsConfirmed: true,

      };

      await uploadPreparedTrack(body);

      resetUploadForm();

      await loadAlbums();

      if (viewMode === 'album' && selectedAlbum) {

        await loadTracks(selectedAlbum.id);

      } else if (viewMode === 'loose') {

        await loadTracks('loose');

      }

    } catch (err) {

      setUploadError(err instanceof Error ? err.message : t('profile.compositions.uploadFailed'));

    } finally {

      setUploading(false);

    }

  };



  const handleCoverPick = async (file: File) => {

    setCreateAlbumError(null);

    const validationError = validateCoverFile(file);

    if (validationError) {

      setCreateAlbumError(validationError);

      return;

    }

    try {

      const dataUrl = await readFileAsDataUrl(file);

      setAlbumCoverDataUrl(dataUrl);

      setAlbumCoverName(file.name);

    } catch {

      setCreateAlbumError(t('profile.compositions.createAlbumFailed'));

    }

  };



  const submitCreateAlbum = async (e: React.FormEvent) => {

    e.preventDefault();

    if (!token || creatingAlbum || !albumTitle.trim()) return;

    setCreateAlbumError(null);

    setCreatingAlbum(true);

    try {

      const { album } = await api.createAlbum(token, {

        title: albumTitle.trim(),

        description: albumDescription.trim() || undefined,

        coverUrl: albumCoverDataUrl ?? undefined,

      });

      resetCreateAlbumForm();

      await loadAlbums();

      setSelectedAlbum(album);

      setViewMode('album');

    } catch (err) {

      setCreateAlbumError(

        err instanceof Error ? err.message : t('profile.compositions.createAlbumFailed')

      );

    } finally {

      setCreatingAlbum(false);

    }

  };



  const togglePlay = (item: UserCompositionItem) => {

    if (playingId === item.id) {

      audioRef.current?.pause();

      setPlayingId(null);

      return;

    }

    audioRef.current?.pause();

    const audio = new Audio(item.fileUrl);

    audioRef.current = audio;

    audio.onended = () => setPlayingId(null);

    audio.onerror = () => setPlayingId(null);

    void audio.play().then(() => setPlayingId(item.id)).catch(() => setPlayingId(null));

  };



  const requestDeleteTrack = (id: string) => {

    if (!token || !isOwner) return;

    setConfirmDeleteId(id);

  };



  const handleUpvoteTrack = async (compositionId: string) => {

    if (!token) return;

    setUpvotingId(compositionId);

    try {

      const result = await api.toggleCompositionUpvote(token, compositionId);

      setTracks((prev) =>

        prev.map((track) =>

          track.id === compositionId

            ? { ...track, upvoteCount: result.upvoteCount, userHasUpvoted: result.userHasUpvoted }

            : track

        )

      );

    } catch (err) {

      showToast(err instanceof Error ? err.message : 'Erreur');

    } finally {

      setUpvotingId(null);

    }

  };



  const confirmDeleteTrack = async () => {

    if (!token || !confirmDeleteId) return;

    const id = confirmDeleteId;

    setDeletingId(id);

    try {

      if (playingId === id) {

        audioRef.current?.pause();

        setPlayingId(null);

      }

      await api.deleteComposition(token, id);

      await loadAlbums();

      if (viewMode === 'album' && selectedAlbum) {

        await loadTracks(selectedAlbum.id);

      } else if (viewMode === 'loose') {

        await loadTracks('loose');

      }

      setConfirmDeleteId(null);

    } catch (err) {

      alert(err instanceof Error ? err.message : t('profile.compositions.deleteFailed'));

    } finally {

      setDeletingId(null);

    }

  };



  const confirmDeleteAlbum = async () => {

    if (!token || !confirmDeleteAlbumId) return;

    const albumId = confirmDeleteAlbumId;

    setDeletingAlbumId(albumId);

    try {

      await api.deleteAlbum(token, albumId);

      setConfirmDeleteAlbumId(null);

      setViewMode('grid');

      setSelectedAlbum(null);

      await loadAlbums();

    } catch (err) {

      alert(err instanceof Error ? err.message : t('profile.compositions.deleteAlbumFailed'));

    } finally {

      setDeletingAlbumId(null);

    }

  };



  const pendingDeleteAlbum =
    confirmDeleteAlbumId != null
      ? albums.find((a) => a.id === confirmDeleteAlbumId) ?? selectedAlbum
      : null;



  const openAlbum = (album: UserAlbumItem) => {

    setSelectedAlbum(album);

    setViewMode('album');

  };



  const openLooseTracks = () => {

    setSelectedAlbum(null);

    setViewMode('loose');

  };



  const backToGrid = () => {

    setViewMode('grid');

    setSelectedAlbum(null);

    audioRef.current?.pause();

    setPlayingId(null);

  };



  useEffect(() => {

    if (loading || albums.length === 0 || albumDeepLinkHandledRef.current) return;

    const albumId = new URLSearchParams(window.location.search).get('album');

    if (!albumId) return;

    const album = albums.find((a) => a.id === albumId);

    if (!album) return;

    albumDeepLinkHandledRef.current = true;

    setSelectedAlbum(album);

    setViewMode('album');

  }, [loading, albums]);



  useEffect(() => {

    if (loading || trackDeepLinkHandledRef.current || !token || !ownerId) return;

    const trackId = new URLSearchParams(window.location.search).get('track');

    if (!trackId) return;

    trackDeepLinkHandledRef.current = true;

    void (async () => {

      try {

        const loose = await api.getAlbumTracks(token, ownerId, 'loose');

        if (loose.tracks.some((track) => track.id === trackId)) {

          setSelectedAlbum(null);

          setViewMode('loose');

          return;

        }

        for (const album of albums) {

          const albumTracks = await api.getAlbumTracks(token, ownerId, album.id);

          if (albumTracks.tracks.some((track) => track.id === trackId)) {

            setSelectedAlbum(album);

            setViewMode('album');

            return;

          }

        }

      } catch {

        /* ignore deep link errors */

      }

    })();

  }, [loading, albums, token, ownerId]);



  const shareDisplayName = defaultArtist || me?.username || 'Soundy';



  const buildDefaultPostContent = (album: UserAlbumItem) => {

    const lines = [t('profile.compositions.createPostDefault', { title: album.title })];

    if (album.description?.trim()) lines.push(album.description.trim());

    return lines.join('\n\n');

  };



  const openShareForAlbum = (album: UserAlbumItem) => {

    setShareAlbum(album);

    setShareAlbumUrl('');

    void getAlbumShareUrl(ownerId, album.id).then((url) => setShareAlbumUrl(url));

  };



  const openPostForAlbum = (album: UserAlbumItem) => {

    setPostAlbum(album);

    setPostDraft(buildDefaultPostContent(album));

    setPostError(null);

  };



  const closePostAlbum = () => {

    if (postPublishing) return;

    setPostAlbum(null);

    setPostDraft('');

    setPostError(null);

  };



  const publishAlbumPost = async () => {

    if (!token || !postAlbum || postPublishing) return;

    const content = postDraft.trim();

    if (!content) return;

    setPostPublishing(true);

    setPostError(null);

    try {

      const body: { content: string; imageUrl?: string } = { content };

      const cover = albumCoverForFeed(postAlbum.coverUrl);

      if (cover) body.imageUrl = cover;

      await api.createFeedPost(token, body);

      setPostAlbum(null);

      setPostDraft('');

      setToastMsg(t('profile.compositions.createPostSuccess'));

    } catch (e) {

      setPostError(

        e instanceof Error ? e.message : t('profile.compositions.createPostFailed')

      );

    } finally {

      setPostPublishing(false);

    }

  };



  const renderAlbumActionButtons = (album: UserAlbumItem, size: 'sm' | 'md' = 'sm') => {

    const btnClass =

      size === 'md'

        ? 'w-8 h-8'

        : 'w-7 h-7';

    const iconClass = size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5';

    return (

      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>

        <button

          type="button"

          onClick={() => openShareForAlbum(album)}

          className={`${btnClass} flex items-center justify-center rounded-full border border-[#2d2d3d] bg-[#1a1a26] text-gray-400 hover:text-white hover:border-purple-500/40 transition active:scale-95`}

          title={t('profile.compositions.shareAlbum')}

          aria-label={t('profile.compositions.shareAlbum')}

        >

          <ShareIcon className={iconClass} />

        </button>

        {isOwner && (

          <button

            type="button"

            onClick={() => openPostForAlbum(album)}

            className={`${btnClass} flex items-center justify-center rounded-full border border-[#2d2d3d] bg-[#1a1a26] text-gray-400 hover:text-purple-300 hover:border-purple-500/40 transition active:scale-95`}

            title={t('profile.compositions.createPost')}

            aria-label={t('profile.compositions.createPost')}

          >

            <PostIcon className={iconClass} />

          </button>

        )}

      </div>

    );

  };



  const hasContent = albums.length > 0 || looseTrackCount > 0;

  const detailTitle =

    viewMode === 'loose'

      ? t('profile.compositions.looseTracks')

      : selectedAlbum?.title ?? '';



  const renderTrackList = () => {

    if (tracksLoading) {

      return <p className="text-xs text-gray-500 text-center py-8">{t('common.loading')}</p>;

    }

    if (tracks.length === 0) {

      return null;

    }

    return (

      <ul className="space-y-2">

        {tracks.map((item) => {

          const date = new Date(item.createdAt).toLocaleDateString(undefined, {

            day: 'numeric',

            month: 'short',

            year: 'numeric',

          });

          const isPlaying = playingId === item.id;

          return (

            <li

              key={item.id}

              className="flex items-center gap-3 rounded-xl border border-[#2d2d3d] bg-[#12121a] p-3"

            >

              <button

                type="button"

                onClick={() => togglePlay(item)}

                aria-label={isPlaying ? t('profile.compositions.pause') : t('profile.compositions.play')}

                className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition ${

                  isPlaying

                    ? 'bg-purple-600 text-white'

                    : 'bg-[#1a1a26] border border-purple-500/40 text-purple-300 hover:bg-purple-950/40'

                }`}

              >

                {isPlaying ? '⏸' : '▶'}

              </button>

              <div className="min-w-0 flex-1">

                <p className="text-sm font-bold text-white truncate">{item.title}</p>

                <p className="text-[11px] text-gray-500 truncate">

                  {[item.artist, formatDurationSec(item.durationSec), date].filter(Boolean).join(' · ')}

                </p>

              </div>

              {token && (

                <CompositionUpvoteButton

                  track={item}

                  disabled={upvotingId === item.id}

                  onToggle={handleUpvoteTrack}

                />

              )}

              {isOwner && (

                <button

                  type="button"

                  onClick={() => requestDeleteTrack(item.id)}

                  disabled={deletingId === item.id}

                  title={t('profile.compositions.delete')}

                  aria-label={t('profile.compositions.delete')}

                  className="shrink-0 w-9 h-9 rounded-full bg-black/50 border border-red-500/40 text-red-300 text-xs hover:bg-red-950/60 disabled:opacity-50"

                >

                  {deletingId === item.id ? '…' : '🗑'}

                </button>

              )}

            </li>

          );

        })}

      </ul>

    );

  };



  const renderAlbumCard = (album: UserAlbumItem) => (

    <div

      key={album.id}

      className="text-left rounded-xl border border-[#2d2d3d] bg-[#12121a] overflow-hidden hover:border-purple-500/50 transition group"

    >

      <button

        type="button"

        onClick={() => openAlbum(album)}

        className="w-full text-left"

      >

        <div className="aspect-square bg-[#1a1a26] flex items-center justify-center overflow-hidden">

          {album.coverUrl ? (

            <img src={album.coverUrl} alt="" className="w-full h-full object-cover" />

          ) : (

            <span className="text-4xl text-purple-400/60 group-hover:text-purple-300 transition" aria-hidden>

              💿

            </span>

          )}

        </div>

      </button>

      <div className="p-3 space-y-0.5">

        <p className="text-sm font-bold text-white truncate">{album.title}</p>

        <div className="flex items-center justify-between gap-2 min-w-0">

          <p className="text-[11px] text-gray-500 truncate">

            {t('profile.compositions.trackCount', { count: album.trackCount })}

          </p>

          {renderAlbumActionButtons(album)}

        </div>

      </div>

    </div>

  );



  return (

    <>

      <section className="p-4 max-w-lg mx-auto w-full space-y-3">

        {viewMode !== 'grid' && (

          <div className="flex items-center gap-2">

            <button

              type="button"

              onClick={backToGrid}

              className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-[#1a1a26] border border-[#2d2d3d] text-gray-400 hover:text-white transition"

              aria-label={t('profile.compositions.backToAlbums')}

            >

              ←

            </button>

            {viewMode === 'album' && selectedAlbum && (

              <div className="shrink-0 w-9 h-9 rounded-lg overflow-hidden bg-[#1a1a26] flex items-center justify-center">

                {selectedAlbum.coverUrl ? (

                  <img

                    src={selectedAlbum.coverUrl}

                    alt=""

                    className="w-full h-full object-cover"

                  />

                ) : (

                  <span className="text-lg text-purple-400/60" aria-hidden>

                    💿

                  </span>

                )}

              </div>

            )}

            <div className="min-w-0 flex-1">

              <h3 className="text-sm font-bold text-white truncate">{detailTitle}</h3>

              {viewMode === 'album' && selectedAlbum?.description && (

                <p className="text-[11px] text-gray-500 truncate">{selectedAlbum.description}</p>

              )}

            </div>

            {viewMode === 'album' && selectedAlbum && renderAlbumActionButtons(selectedAlbum, 'md')}

            {isOwner && viewMode === 'album' && selectedAlbum && (

              <button

                type="button"

                onClick={() => setConfirmDeleteAlbumId(selectedAlbum.id)}

                disabled={deletingAlbumId === selectedAlbum.id}

                title={t('profile.compositions.deleteAlbum')}

                className="shrink-0 w-8 h-8 rounded-full border border-red-500/40 text-red-300 text-xs hover:bg-red-950/60 disabled:opacity-50"

              >

                🗑

              </button>

            )}

          </div>

        )}



        {viewMode === 'grid' && isOwner && hasContent && (

          <button

            type="button"

            onClick={() => setShowCreateAlbum(true)}

            className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 font-bold text-white text-sm transition"

          >

            {t('profile.compositions.createAlbum')}

          </button>

        )}



        {viewMode !== 'grid' && isOwner && (

          <label className="flex items-start gap-2 text-left px-1">

            <input

              type="checkbox"

              checked={uploadRightsConfirmed}

              onChange={(e) => setUploadRightsConfirmed(e.target.checked)}

              className="mt-0.5 w-4 h-4 rounded border-gray-600 accent-purple-600"

            />

            <span className="text-[11px] text-gray-400 leading-snug">

              {t('profile.compositions.rightsConfirmLabel')}

            </span>

          </label>

        )}



        {viewMode !== 'grid' && isOwner && (

          <button

            type="button"

            onClick={openFilePicker}

            disabled={importing || uploading}

            className="w-full py-3 rounded-xl border-2 border-dashed border-purple-500/40 bg-[#0b0b12] hover:border-purple-500/70 hover:bg-purple-950/20 transition-colors flex flex-col items-center justify-center gap-2 disabled:opacity-50"

          >

            {importing ? (

              <>

                <span className="w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />

                <span className="text-xs font-semibold text-purple-300">

                  {t('profile.compositions.importing')}

                </span>

              </>

            ) : uploading ? (

              <>

                <span className="w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />

                <span className="text-xs font-semibold text-purple-300">

                  {batchUploadProgress

                    ? t('profile.compositions.uploadingBatch', batchUploadProgress)

                    : t('profile.compositions.uploading')}

                </span>

              </>

            ) : (

              <>

                <span className="text-2xl text-purple-400" aria-hidden>

                  ♪

                </span>

                <span className="text-sm font-bold text-purple-200">

                  {t('profile.compositions.addTrack')}

                </span>

                <span className="text-[10px] text-gray-500">{t('profile.compositions.uploadHint')}</span>

              </>

            )}

          </button>

        )}



        <input

          ref={fileInputRef}

          type="file"

          multiple

          accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a,audio/ogg,audio/webm,.mp3,.wav,.m4a,.ogg"

          className="hidden"

          onChange={(e) => {

            const files = Array.from(e.target.files ?? []);

            e.target.value = '';

            handleAudioFilesPick(files);

          }}

        />



        {uploadError && !pendingUpload && viewMode !== 'grid' && (

          <p className="text-sm text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-2">

            {uploadError}

          </p>

        )}



        {loading && viewMode === 'grid' && (

          <p className="text-xs text-gray-500 text-center py-8">{t('common.loading')}</p>

        )}



        {viewMode === 'grid' && !loading && (

          <div className="grid grid-cols-2 gap-3">

            {albums.map(renderAlbumCard)}

            {isOwner && !hasContent && (

              <button

                type="button"

                onClick={() => setShowCreateAlbum(true)}

                className="text-left rounded-xl border border-dashed border-purple-500/40 bg-[#12121a] overflow-hidden hover:border-purple-500/60 transition"

              >

                <div className="aspect-square bg-[#1a1a26] flex items-center justify-center">

                  <span className="text-4xl text-purple-400/60" aria-hidden>

                    +

                  </span>

                </div>

                <div className="p-3 space-y-0.5">

                  <p className="text-sm font-bold text-purple-200 truncate">

                    {t('profile.compositions.createAlbum')}

                  </p>

                </div>

              </button>

            )}

            {looseTrackCount > 0 && (

              <button

                type="button"

                onClick={openLooseTracks}

                className="text-left rounded-xl border border-dashed border-[#2d2d3d] bg-[#12121a] overflow-hidden hover:border-purple-500/40 transition"

              >

                <div className="aspect-square bg-[#1a1a26] flex items-center justify-center">

                  <span className="text-4xl text-gray-500" aria-hidden>

                    🎵

                  </span>

                </div>

                <div className="p-3 space-y-0.5">

                  <p className="text-sm font-bold text-white truncate">

                    {t('profile.compositions.looseTracks')}

                  </p>

                  <p className="text-[11px] text-gray-500">

                    {t('profile.compositions.looseTracksHint', { count: looseTrackCount })}

                  </p>

                </div>

              </button>

            )}

          </div>

        )}



        {viewMode !== 'grid' && renderTrackList()}

      </section>



      {pendingUpload && (

        <div

          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"

          role="dialog"

          aria-modal="true"

          aria-labelledby="composition-upload-title"

        >

          <form

            onSubmit={(e) => void submitUpload(e)}

            className="w-full max-w-sm rounded-2xl bg-[#12121a] border border-[#2d2d3d] p-4 space-y-3 shadow-xl"

          >

            <h4 id="composition-upload-title" className="text-sm font-bold text-white">

              {t('profile.compositions.uploadTitle')}

            </h4>

            <p className="text-[11px] text-gray-500 truncate">{pendingUpload.fileName}</p>

            {pendingUpload.durationSec != null && (

              <p className="text-[11px] text-purple-300">

                {t('profile.compositions.duration')}: {formatDurationSec(pendingUpload.durationSec)}

              </p>

            )}

            <label className="block">

              <span className="text-xs text-gray-400">{t('profile.compositions.fieldTitle')}</span>

              <input

                value={uploadTitle}

                onChange={(e) => setUploadTitle(e.target.value)}

                required

                maxLength={120}

                className="mt-0.5 w-full rounded-lg bg-[#1a1a28] border border-[#2d2d3d] px-2.5 py-1.5 text-sm text-white"

              />

            </label>

            <label className="block">

              <span className="text-xs text-gray-400">{t('profile.compositions.fieldArtist')}</span>

              <input

                value={uploadArtist}

                onChange={(e) => setUploadArtist(e.target.value)}

                maxLength={120}

                placeholder={defaultArtist}

                className="mt-0.5 w-full rounded-lg bg-[#1a1a28] border border-[#2d2d3d] px-2.5 py-1.5 text-sm text-white"

              />

            </label>

            <label className="flex items-start gap-2">

              <input

                type="checkbox"

                checked={uploadRightsConfirmed}

                onChange={(e) => setUploadRightsConfirmed(e.target.checked)}

                className="mt-0.5 w-4 h-4 rounded border-gray-600 accent-purple-600"

              />

              <span className="text-[11px] text-gray-400 leading-snug">

                {t('profile.compositions.rightsConfirmLabel')}

              </span>

            </label>

            {uploadError && (

              <p className="text-xs text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg px-2 py-1.5">

                {uploadError}

              </p>

            )}

            <div className="flex gap-2">

              <button

                type="button"

                onClick={resetUploadForm}

                disabled={uploading}

                className="flex-1 py-2.5 rounded-xl bg-[#1a1a26] border border-[#2d2d3d] text-sm font-semibold text-gray-300 disabled:opacity-40"

              >

                {t('common.cancel')}

              </button>

              <button

                type="submit"

                disabled={uploading || !uploadTitle.trim() || !uploadRightsConfirmed}

                className="flex-[2] py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 font-bold text-white text-sm disabled:opacity-40"

              >

                {uploading ? t('profile.compositions.uploading') : t('profile.compositions.uploadSubmit')}

              </button>

            </div>

          </form>

        </div>

      )}



      {showCreateAlbum && (

        <div

          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"

          role="dialog"

          aria-modal="true"

          aria-labelledby="create-album-title"

        >

          <form

            onSubmit={(e) => void submitCreateAlbum(e)}

            className="w-full max-w-sm rounded-2xl bg-[#12121a] border border-[#2d2d3d] p-4 space-y-3 shadow-xl"

          >

            <h4 id="create-album-title" className="text-sm font-bold text-white">

              {t('profile.compositions.createAlbumTitle')}

            </h4>

            <label className="block">

              <span className="text-xs text-gray-400">{t('profile.compositions.fieldAlbumTitle')}</span>

              <input

                value={albumTitle}

                onChange={(e) => setAlbumTitle(e.target.value)}

                required

                maxLength={120}

                className="mt-0.5 w-full rounded-lg bg-[#1a1a28] border border-[#2d2d3d] px-2.5 py-1.5 text-sm text-white"

              />

            </label>

            <label className="block">

              <span className="text-xs text-gray-400">{t('profile.compositions.fieldAlbumDescription')}</span>

              <textarea

                value={albumDescription}

                onChange={(e) => setAlbumDescription(e.target.value)}

                maxLength={500}

                rows={2}

                className="mt-0.5 w-full rounded-lg bg-[#1a1a28] border border-[#2d2d3d] px-2.5 py-1.5 text-sm text-white resize-none"

              />

            </label>

            <div className="space-y-1">

              <span className="text-xs text-gray-400">{t('profile.compositions.fieldAlbumCover')}</span>

              <button

                type="button"

                onClick={() => coverInputRef.current?.click()}

                className="w-full py-2 rounded-lg border border-dashed border-purple-500/40 text-xs text-purple-200 hover:bg-purple-950/20 transition"

              >

                {albumCoverName || t('profile.compositions.pickCover')}

              </button>

              <p className="text-[10px] text-gray-500">{t('profile.compositions.coverHint')}</p>

              {albumCoverDataUrl && (

                <img

                  src={albumCoverDataUrl}

                  alt=""

                  className="mt-1 w-20 h-20 rounded-lg object-cover border border-[#2d2d3d]"

                />

              )}

            </div>

            <input

              ref={coverInputRef}

              type="file"

              accept={COVER_ACCEPT}

              className="hidden"

              onChange={(e) => {

                const file = e.target.files?.[0];

                e.target.value = '';

                if (file) void handleCoverPick(file);

              }}

            />

            {createAlbumError && (

              <p className="text-xs text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg px-2 py-1.5">

                {createAlbumError}

              </p>

            )}

            <div className="flex gap-2">

              <button

                type="button"

                onClick={resetCreateAlbumForm}

                disabled={creatingAlbum}

                className="flex-1 py-2.5 rounded-xl bg-[#1a1a26] border border-[#2d2d3d] text-sm font-semibold text-gray-300 disabled:opacity-40"

              >

                {t('common.cancel')}

              </button>

              <button

                type="submit"

                disabled={creatingAlbum || !albumTitle.trim()}

                className="flex-[2] py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 font-bold text-white text-sm disabled:opacity-40"

              >

                {creatingAlbum

                  ? t('profile.compositions.creatingAlbum')

                  : t('profile.compositions.createAlbumSubmit')}

              </button>

            </div>

          </form>

        </div>

      )}



      <ConfirmModal

        open={confirmDeleteId !== null}

        title={t('profile.compositions.deleteConfirm')}

        description=""

        loading={Boolean(deletingId && confirmDeleteId === deletingId)}

        loadingLabel={t('profile.compositions.uploading')}

        onCancel={() => setConfirmDeleteId(null)}

        onConfirm={() => void confirmDeleteTrack()}

      />



      <ConfirmModal

        open={confirmDeleteAlbumId !== null}

        title={t('profile.compositions.deleteAlbumConfirm', {
          title: pendingDeleteAlbum?.title ?? '',
        })}

        cancelLabel={t('common.cancel')}

        confirmLabel={t('common.delete')}

        loading={Boolean(deletingAlbumId && confirmDeleteAlbumId === deletingAlbumId)}

        loadingLabel={t('profile.compositions.uploading')}

        onCancel={() => setConfirmDeleteAlbumId(null)}

        onConfirm={() => void confirmDeleteAlbum()}

      />



      {shareAlbum && shareAlbumUrl && !shareToUserOpen && (

        <ShareLinkMenu

          open

          onClose={() => {

            setShareAlbum(null);

            setShareAlbumUrl('');

          }}

          url={shareAlbumUrl}

          title={`${shareAlbum.title} — Soundy`}

          text={t('profile.compositions.shareAlbumText', {

            title: shareAlbum.title,

            username: shareDisplayName,

          })}

          onToast={setToastMsg}

          onSendToUser={token ? () => setShareToUserOpen(true) : undefined}

        />

      )}



      {shareAlbum && shareAlbumUrl && shareToUserOpen && token && (

        <ShareToUserSheet

          open

          onBack={() => setShareToUserOpen(false)}

          onClose={() => {

            setShareToUserOpen(false);

            setShareAlbum(null);

            setShareAlbumUrl('');

          }}

          token={token}

          shareUrl={shareAlbumUrl}

          shareText={t('profile.compositions.shareAlbumText', {

            title: shareAlbum.title,

            username: shareDisplayName,

          })}

          onToast={setToastMsg}

        />

      )}



      {postAlbum && (

        <div

          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"

          role="dialog"

          aria-modal="true"

          aria-labelledby="album-post-title"

        >

          <form

            onSubmit={(e) => {

              e.preventDefault();

              void publishAlbumPost();

            }}

            className="w-full max-w-sm rounded-2xl bg-[#12121a] border border-[#2d2d3d] p-4 space-y-3 shadow-xl"

          >

            <h4 id="album-post-title" className="text-sm font-bold text-white">

              {t('profile.compositions.createPostTitle')}

            </h4>

            <p className="text-[11px] text-gray-500">{t('profile.compositions.createPostHint')}</p>

            <div className="flex items-center gap-3">

              <div className="shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-[#1a1a26] flex items-center justify-center border border-[#2d2d3d]">

                {postAlbum.coverUrl ? (

                  <img src={postAlbum.coverUrl} alt="" className="w-full h-full object-cover" />

                ) : (

                  <span className="text-xl text-purple-400/60" aria-hidden>💿</span>

                )}

              </div>

              <div className="min-w-0">

                <p className="text-sm font-bold text-white truncate">{postAlbum.title}</p>

                <p className="text-[11px] text-gray-500">

                  {t('profile.compositions.trackCount', { count: postAlbum.trackCount })}

                </p>

              </div>

            </div>

            <label className="block">

              <textarea

                value={postDraft}

                onChange={(e) => setPostDraft(e.target.value)}

                placeholder={t('profile.compositions.createPostPlaceholder')}

                rows={4}

                maxLength={2000}

                className="mt-0.5 w-full rounded-lg bg-[#1a1a28] border border-[#2d2d3d] px-2.5 py-1.5 text-sm text-white resize-none"

              />

            </label>

            {postError && (

              <p className="text-xs text-red-400">{postError}</p>

            )}

            <div className="flex gap-2">

              <button

                type="button"

                onClick={closePostAlbum}

                disabled={postPublishing}

                className="flex-1 py-2.5 rounded-xl border border-[#2d2d3d] text-gray-300 text-sm font-semibold hover:bg-[#1a1a28] disabled:opacity-40"

              >

                {t('common.cancel')}

              </button>

              <button

                type="submit"

                disabled={postPublishing || !postDraft.trim()}

                className="flex-[2] py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 font-bold text-white text-sm disabled:opacity-40"

              >

                {postPublishing

                  ? t('profile.compositions.createPostPublishing')

                  : t('profile.compositions.createPostSubmit')}

              </button>

            </div>

          </form>

        </div>

      )}



      {toastMsg && (

        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-[70] pointer-events-none max-w-[90vw]">

          <div className="px-4 py-2.5 rounded-full bg-[#1a1a26]/95 border border-white/15 text-sm text-white shadow-lg backdrop-blur-md text-center">

            {toastMsg}

          </div>

        </div>

      )}

    </>

  );

}


