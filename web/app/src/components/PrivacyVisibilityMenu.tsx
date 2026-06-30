import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

export function PrivacyVisibilityMenu() {
  const { user, token, setUserFromProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const isGhostMode = user?.isGhostMode === true;
  const shareDistance = user?.shareDistance !== false;
  const cityOnly = user?.locationPrecision === 'city';

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open]);

  const patchSettings = async (body: { shareDistance?: boolean; locationPrecision?: 'precise' | 'city' }) => {
    if (!token || !user) return;
    const prevShareDistance = user.shareDistance;
    const prevLocationPrecision = user.locationPrecision;
    if (body.shareDistance !== undefined) {
      setUserFromProfile({ ...user, shareDistance: body.shareDistance });
    }
    if (body.locationPrecision !== undefined) {
      setUserFromProfile({ ...user, locationPrecision: body.locationPrecision });
    }
    setSaving(true);
    try {
      const r = await api.updatePrivacySettings(token, body);
      setUserFromProfile(r.user);
    } catch (e) {
      setUserFromProfile({
        ...user,
        shareDistance: prevShareDistance,
        locationPrecision: prevLocationPrecision,
      });
      alert(e instanceof Error ? e.message : 'Impossible d\'enregistrer');
    } finally {
      setSaving(false);
    }
  };

  const toggleShareDistance = () => {
    void patchSettings({ shareDistance: !shareDistance });
  };

  const toggleCityOnly = () => {
    void patchSettings({ locationPrecision: cityOnly ? 'precise' : 'city' });
  };

  const toggleGhostMode = () => {
    if (!token || !user) return;
    const prevGhost = isGhostMode;
    const next = !isGhostMode;
    setUserFromProfile({ ...user, isGhostMode: next });
    setSaving(true);
    void (async () => {
      try {
        const r = await api.toggleGhost(token, next);
        setUserFromProfile({ ...user, isGhostMode: r.isGhostMode });
      } catch (e) {
        setUserFromProfile({ ...user, isGhostMode: prevGhost });
        alert(e instanceof Error ? e.message : 'Impossible d\'enregistrer');
      } finally {
        setSaving(false);
      }
    })();
  };

  const activePrivacy = isGhostMode || !shareDistance || cityOnly;

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Confidentialité et visibilité"
        aria-label="Confidentialité et visibilité"
        aria-expanded={open}
        className={`p-1.5 sm:p-2 rounded-full transition shrink-0 ${
          activePrivacy
            ? 'text-purple-400/90 bg-purple-500/10 hover:bg-purple-500/20'
            : 'text-gray-500/70 hover:text-gray-400 hover:bg-[#1a1a26] opacity-60 hover:opacity-100'
        }`}
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path
            d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49M14.084 14.158a3 3 0 0 1-4.242-4.242"
            strokeLinecap="round"
          />
          <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" strokeLinecap="round" />
          <path d="m2 2 20 20" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Paramètres de confidentialité"
          className="absolute right-0 top-full mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-xl border border-[#2d2d3d] bg-[#12121a] shadow-xl shadow-black/50 z-50 p-3"
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-purple-400/90 mb-2">
            Invisible · confidentialité
          </p>

          <label className="flex items-start gap-2.5 py-2 cursor-pointer group border-b border-[#1e1e2f] pb-3 mb-1">
            <input
              type="checkbox"
              className="melosong-checkbox mt-0.5"
              checked={isGhostMode}
              disabled={saving}
              onChange={toggleGhostMode}
            />
            <span className="text-xs text-gray-300 leading-snug group-hover:text-white transition">
              Masquer ma position sur la carte (invisible pour les autres)
            </span>
          </label>

          <label className="flex items-start gap-2.5 py-2 cursor-pointer group">
            <input
              type="checkbox"
              className="melosong-checkbox mt-0.5"
              checked={!shareDistance}
              disabled={saving}
              onChange={toggleShareDistance}
            />
            <span className="text-xs text-gray-300 leading-snug group-hover:text-white transition">
              Ne communique pas la distance aux autres utilisateurs
            </span>
          </label>

          <label className="flex items-start gap-2.5 py-2 cursor-pointer group border-t border-[#1e1e2f] mt-1">
            <input
              type="checkbox"
              className="melosong-checkbox mt-0.5"
              checked={cityOnly}
              disabled={saving}
              onChange={toggleCityOnly}
            />
            <span className="text-xs text-gray-300 leading-snug group-hover:text-white transition">
              N&apos;est pas précis sur la localisation : seule la ville sera affichée
            </span>
          </label>

          {saving && <p className="text-[10px] text-gray-500 text-center pt-1">Enregistrement…</p>}
        </div>
      )}
    </div>
  );
}
