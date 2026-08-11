import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { USERNAME_WAVE_CLASS } from '../lib/usernameColor';

type MapCreateActionFabProps = {
  onStartLive: () => void;
  liveStarting: boolean;
  liveMediaSetupOpen: boolean;
  onCreateEvent: () => void;
  eventPublishing: boolean;
  onCreateSalon: () => void;
};

const OPTION_BTN =
  'w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl bg-[#1a1a24] border border-[#2d2d3d] hover:border-purple-500/60 active:scale-[0.98] transition text-left disabled:opacity-50 disabled:pointer-events-none';

/**
 * FAB unique "+" carte : remplace les 3 boutons Lives/Event/Salon par une seule bulle
 * de chat proposant les 3 choix, pour libérer l'espace horizontal sur petit écran.
 */
export function MapCreateActionFab({
  onStartLive,
  liveStarting,
  liveMediaSetupOpen,
  onCreateEvent,
  eventPublishing,
  onCreateSalon,
}: MapCreateActionFabProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  const choose = (action: () => void) => {
    setOpen(false);
    action();
  };

  const liveBusy = liveStarting || liveMediaSetupOpen;

  return (
    <div
      ref={rootRef}
      className="ms-map-salon-fab ms-map-create-menu absolute z-30 pointer-events-auto flex flex-col items-start gap-2"
    >
      {open && (
        <div
          role="dialog"
          aria-label={t('map.createChatTitle', { defaultValue: 'Que veux-tu faire ?' })}
          className="ms-map-create-chat w-[min(88vw,19rem)] rounded-2xl border border-[#2d2d3d] bg-[#12121a]/95 backdrop-blur-md shadow-2xl shadow-black/50 p-3 flex flex-col gap-2"
        >
          <div className="flex items-center gap-2 px-1 pb-1">
            <span className="text-lg leading-none" aria-hidden>
              💬
            </span>
            <p className="text-sm font-bold text-white/90">
              {t('map.createChatTitle', { defaultValue: 'Que veux-tu faire ?' })}
            </p>
          </div>

          <button
            type="button"
            className={OPTION_BTN}
            disabled={liveBusy}
            aria-label={t('map.createLiveFabAria', { defaultValue: 'Créer un live' })}
            onClick={() => choose(onStartLive)}
          >
            <span className="text-xl leading-none shrink-0" aria-hidden>
              🎥
            </span>
            <span className="flex flex-col min-w-0">
              <span className={`font-bold text-sm ${USERNAME_WAVE_CLASS}`}>
                {liveBusy
                  ? t('map.startingLive', { defaultValue: 'Démarrage…' })
                  : t('map.createChatLive', { defaultValue: 'Démarrer un live' })}
              </span>
              <span className="text-xs text-white/50 truncate">
                {t('map.createChatLiveHint', { defaultValue: 'Diffuse en direct sur la carte' })}
              </span>
            </span>
          </button>

          <button
            type="button"
            className={OPTION_BTN}
            disabled={eventPublishing}
            aria-label={t('map.createEventFabAria', { defaultValue: 'Créer un événement' })}
            onClick={() => choose(onCreateEvent)}
          >
            <span className="text-xl leading-none shrink-0" aria-hidden>
              📅
            </span>
            <span className="flex flex-col min-w-0">
              <span className={`font-bold text-sm ${USERNAME_WAVE_CLASS}`}>
                {t('map.createChatEvent', { defaultValue: 'Créer un événement' })}
              </span>
              <span className="text-xs text-white/50 truncate">
                {t('map.createChatEventHint', { defaultValue: 'Publie un événement sur la carte' })}
              </span>
            </span>
          </button>

          <button
            type="button"
            className={OPTION_BTN}
            aria-label={t('home.createSalon', { defaultValue: 'Créer un salon musical' })}
            onClick={() => choose(onCreateSalon)}
          >
            <span className="text-xl leading-none shrink-0" aria-hidden>
              🎵
            </span>
            <span className="flex flex-col min-w-0">
              <span className={`font-bold text-sm ${USERNAME_WAVE_CLASS}`}>
                {t('map.createChatSalon', { defaultValue: 'Créer un salon' })}
              </span>
              <span className="text-xs text-white/50 truncate">
                {t('map.createChatSalonHint', { defaultValue: "Lance un salon d'écoute" })}
              </span>
            </span>
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t('map.createFabAria', { defaultValue: 'Créer un live, un événement ou un salon' })}
        aria-expanded={open}
        className={`w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center rounded-full bg-purple-600 hover:bg-purple-500 border border-purple-400/50 text-white shadow-lg shadow-black/40 active:scale-95 transition shrink-0 ${
          open ? 'rotate-45' : ''
        }`}
      >
        <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 sm:w-7 sm:h-7" aria-hidden>
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
