import { useRef, useState } from 'react';

const MAX_PHOTOS = 6;
const MAX_FILE_SIZE_MB = 2;
const MAX_IMAGE_DIMENSION = 800;

async function fileToProfilePhotoDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Veuillez choisir une image (JPG, PNG, etc.)');
  }
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    throw new Error(
      `Image trop lourde (max ${MAX_FILE_SIZE_MB} Mo). Choisissez une photo plus petite ou compressez-la.`
    );
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('Impossible de traiter l\'image');
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  return canvas.toDataURL('image/jpeg', 0.85);
}

interface ProfilePhotoGalleryProps {
  photos: string[];
  fallbackSeed: string;
  editing?: boolean;
  onChange?: (photos: string[]) => void;
}

export function ProfilePhotoGallery({
  photos,
  fallbackSeed,
  editing,
  onChange,
}: ProfilePhotoGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [newUrl, setNewUrl] = useState('');
  const [pickingPhoto, setPickingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const list =
    photos.length > 0
      ? photos
      : [`https://api.dicebear.com/7.x/adventurer/svg?seed=${fallbackSeed}`];

  const safeIndex = Math.min(activeIndex, list.length - 1);
  const current = list[safeIndex];

  const addPhoto = () => {
    const url = newUrl.trim();
    if (!url || !onChange) return;
    if (photos.length >= MAX_PHOTOS) {
      alert(`Maximum ${MAX_PHOTOS} photos`);
      return;
    }
    onChange([...photos, url]);
    setNewUrl('');
    setActiveIndex(photos.length);
  };

  const openGalleryPicker = () => {
    if (photos.length >= MAX_PHOTOS || !onChange) return;
    fileInputRef.current?.click();
  };

  const handleGalleryFile = async (file: File | undefined) => {
    if (!file || !onChange) return;
    if (photos.length >= MAX_PHOTOS) {
      alert(`Maximum ${MAX_PHOTOS} photos`);
      return;
    }
    setPickingPhoto(true);
    try {
      const dataUrl = await fileToProfilePhotoDataUrl(file);
      onChange([...photos, dataUrl]);
      setActiveIndex(photos.length);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Impossible d\'ajouter la photo');
    } finally {
      setPickingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removePhoto = (index: number) => {
    if (!onChange) return;
    const next = photos.filter((_, i) => i !== index);
    onChange(next);
    setActiveIndex(Math.max(0, Math.min(index, next.length - 1)));
  };

  const setAsMain = (index: number) => {
    if (!onChange || index === 0) return;
    const next = [...photos];
    const [picked] = next.splice(index, 1);
    next.unshift(picked);
    onChange(next);
    setActiveIndex(0);
  };

  if (editing) {
    return (
      <div className="bg-[#12121a] border border-[#1e1e2f] rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-purple-400 uppercase">Photos du profil</h3>
          <span className="text-[10px] text-gray-500">
            {photos.length}/{MAX_PHOTOS}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {photos.map((url, i) => (
            <div key={`${url}-${i}`} className="relative aspect-square rounded-xl overflow-hidden border border-[#2d2d3d]">
              <img src={url} alt="" className="w-full h-full object-cover" />
              {i === 0 && (
                <span className="absolute top-1 left-1 text-[8px] bg-purple-600 text-white px-1.5 py-0.5 rounded font-bold">
                  Principale
                </span>
              )}
              <div className="absolute bottom-0 inset-x-0 flex gap-0.5 p-1 bg-black/70">
                {i !== 0 && (
                  <button
                    type="button"
                    onClick={() => setAsMain(i)}
                    className="flex-1 text-[8px] py-0.5 rounded bg-purple-600/90 text-white"
                  >
                    Principale
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  className="px-1.5 text-[10px] rounded bg-red-600/90 text-white"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
          {photos.length < MAX_PHOTOS && (
            <button
              type="button"
              onClick={openGalleryPicker}
              disabled={pickingPhoto}
              className="aspect-square rounded-xl border border-dashed border-[#2d2d3d] flex flex-col items-center justify-center gap-1 text-gray-500 hover:border-purple-500/50 hover:text-purple-400 transition disabled:opacity-50"
              aria-label="Choisir depuis la galerie"
            >
              <span className="text-2xl">{pickingPhoto ? '…' : '🖼️'}</span>
              <span className="text-[8px] font-semibold px-1 text-center leading-tight">Galerie</span>
            </button>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void handleGalleryFile(e.target.files?.[0])}
        />

        {photos.length < MAX_PHOTOS && (
          <>
            <button
              type="button"
              onClick={openGalleryPicker}
              disabled={pickingPhoto}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-pink-600/20 border border-pink-500/40 text-pink-200 text-xs font-bold hover:bg-pink-600/30 disabled:opacity-50 transition"
            >
              <span aria-hidden>🖼️</span>
              {pickingPhoto ? 'Traitement de l\'image…' : 'Choisir depuis la galerie'}
            </button>
            <p className="text-[10px] text-gray-600 text-center">
              JPG, PNG · max {MAX_FILE_SIZE_MB} Mo · redimensionnée automatiquement
            </p>

            <div className="flex gap-2">
              <input
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="Ou coller une URL (https://...)"
                className="flex-1 bg-[#1a1a26] border border-[#2d2d3d] rounded-lg px-3 py-2 text-white text-xs"
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addPhoto())}
              />
              <button
                type="button"
                onClick={addPhoto}
                className="px-3 py-2 bg-purple-600 rounded-lg text-white text-xs font-bold"
              >
                Ajouter
              </button>
            </div>
          </>
        )}

        <button
          type="button"
          onClick={() => {
            const seed = fallbackSeed;
            const url = `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(seed)}`;
            if (photos.length >= MAX_PHOTOS) return;
            onChange?.(photos.length ? [...photos, url] : [url]);
          }}
          disabled={photos.length >= MAX_PHOTOS}
          className="text-xs text-purple-400 font-semibold disabled:opacity-40"
        >
          + Générer un avatar aléatoire
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative mx-auto w-full max-w-xs">
        <img
          src={current}
          alt=""
          className="w-full aspect-square max-h-72 rounded-2xl object-cover border-4 border-[#0b0b0f] shadow-xl bg-[#1a1a26]"
        />
        {list.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => setActiveIndex((i) => (i - 1 + list.length) % list.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white text-lg"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => setActiveIndex((i) => (i + 1) % list.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white text-lg"
            >
              ›
            </button>
          </>
        )}
      </div>
      {list.length > 1 && (
        <div className="flex justify-center gap-2 overflow-x-auto pb-1 px-2">
          {list.map((url, i) => (
            <button
              key={`${url}-${i}`}
              type="button"
              onClick={() => setActiveIndex(i)}
              className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition ${
                i === safeIndex ? 'border-purple-500' : 'border-[#2d2d3d] opacity-60'
              }`}
            >
              <img src={url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
      {list.length > 1 && (
        <p className="text-center text-[10px] text-gray-500">
          {safeIndex + 1} / {list.length} · la première photo est votre avatar
        </p>
      )}
    </div>
  );
}
