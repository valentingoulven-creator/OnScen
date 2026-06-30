import { useState } from 'react';

const PAYPAL_URL: string =
  (import.meta.env.VITE_DONATION_PAYPAL_URL as string | undefined) ?? 'https://paypal.me/getsoundy';

const BMC_URL: string =
  (import.meta.env.VITE_DONATION_BMC_URL as string | undefined) ?? 'https://buymeacoffee.com/soundy';

const PRESET_AMOUNTS = [
  { value: 2, label: 'Un café ☕', linkLabel: 'Un café', icon: '☕' },
  { value: 5, label: 'Un bon repas 🍕', linkLabel: 'Un bon repas', icon: '🍕' },
  { value: 10, label: 'Un vrai coup de pouce 🚀', linkLabel: 'Un vrai coup de pouce', icon: '🚀' },
] as const;

const CUSTOM_AMOUNT_LABEL = 'Montant libre';
const CUSTOM_AMOUNT_TAGLINE = 'Soutiens Soundy comme tu le sens';

function getPaymentPresentation(selected: number | 'custom', customAmount: string) {
  if (selected === 'custom') {
    const amt = Number(customAmount) || 0;
    return {
      linkLabel: amt > 0 ? `${CUSTOM_AMOUNT_LABEL} (${amt} €)` : CUSTOM_AMOUNT_LABEL,
      icon: '💜',
    };
  }

  const preset = PRESET_AMOUNTS.find((p) => p.value === selected);
  return preset
    ? { linkLabel: preset.linkLabel, icon: preset.icon }
    : { linkLabel: 'Soutenir Soundy', icon: '💜' };
}

interface DonationSheetProps {
  onClose: () => void;
}

export function DonationSheet({ onClose }: DonationSheetProps) {
  const [selected, setSelected] = useState<number | 'custom'>(5);
  const [customAmount, setCustomAmount] = useState('');

  const amount = selected === 'custom' ? Number(customAmount) || 0 : selected;
  const { linkLabel, icon } = getPaymentPresentation(selected, customAmount);

  const paypalHref = amount > 0 ? `${PAYPAL_URL}/${amount}EUR` : PAYPAL_URL;
  const bmcHref = BMC_URL;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#12121a] border border-[#1e1e2f] rounded-2xl shadow-2xl p-5 pb-8 max-h-[90dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="w-10 h-1 rounded-full bg-[#2d2d3d] mx-auto mb-4" />

        {/* Header */}
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-lg font-bold text-white">💜 Soutenir Soundy</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl px-2 -mt-0.5 transition"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        <p className="text-sm text-gray-400 leading-relaxed mb-5">
          Chaque contribution aide à maintenir et améliorer l'app pour toute la communauté musicale.
        </p>

        {/* Amount pills */}
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Choisir un montant
        </p>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {PRESET_AMOUNTS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setSelected(value)}
              className={`flex flex-col items-center py-3 px-2 rounded-full border transition active:scale-95 ${
                selected === value
                  ? 'bg-purple-600 border-purple-400 text-white'
                  : 'bg-purple-950/30 border-purple-500/30 text-purple-200 hover:border-purple-400/60'
              }`}
            >
              <span className="text-base font-bold">{value} €</span>
              <span className="text-[10px] mt-0.5 opacity-80">{label}</span>
            </button>
          ))}
        </div>

        {/* Custom amount */}
        <button
          type="button"
          onClick={() => setSelected('custom')}
          className={`w-full mb-2 py-2.5 px-4 rounded-full border text-sm font-semibold transition ${
            selected === 'custom'
              ? 'border-purple-400 bg-purple-900/40 text-white'
              : 'border-[#2d2d3d] bg-[#1a1a26] text-gray-400 hover:border-purple-500/40'
          }`}
        >
          <span>{CUSTOM_AMOUNT_LABEL}</span>
          <span className="block text-[11px] font-normal mt-0.5 opacity-80">{CUSTOM_AMOUNT_TAGLINE}</span>
        </button>
        {selected === 'custom' && (
          <div className="relative mb-4">
            <input
              type="number"
              min="1"
              max="999"
              placeholder="Ex : 3"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              className="w-full bg-[#1a1a26] border border-[#2d2d3d] focus:border-purple-500 rounded-xl px-4 py-3 text-white text-sm outline-none transition"
              autoFocus
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold">
              €
            </span>
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-[#1e1e2f] my-4" />

        {/* Payment buttons */}
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Choisir un moyen de paiement
        </p>

        <a
          href={paypalHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-[#003087] text-white font-bold text-sm hover:bg-[#00257a] active:scale-[0.98] transition mb-3"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M20.067 8.478c.492.315.844.825.983 1.39.47 1.928-.657 4.01-2.49 4.762-.18.074-.361.134-.545.18l-.014.003c-.453.1-.928.122-1.396.066l-.22-.03-.348 2.226H14.1l.347-2.225-.005.003.005-.003H15.1l.34-2.155.012-.077H16.1c.98 0 1.897-.297 2.662-.839a3.9 3.9 0 0 0 1.305-2.3zm-7.455-.56c.038-.003.077-.003.115-.003h1.394c.077 0 .153.003.23.009.88.065 1.617.455 2.053 1.105.44.655.545 1.54.28 2.428-.53 1.788-2.158 2.939-4.079 2.939h-.56l-.547 3.504H9.585l1.684-9.98H13.8c-.065 0-.13.002-.195.003l.007-.006zM7.063 7h3.042c1.025 0 1.895.268 2.49.802.598.535.857 1.311.717 2.183-.302 1.862-1.757 3.065-3.648 3.065h-1.43l-.548 3.448H5.78L7.063 7z" />
          </svg>
          PayPal · {linkLabel}
        </a>

        <a
          href={bmcHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-[#FFDD00] text-black font-bold text-sm hover:bg-[#f5d400] active:scale-[0.98] transition"
        >
          <span aria-hidden="true" className="text-base">{icon}</span>
          {linkLabel}
        </a>

        {/* Dismiss */}
        <button
          type="button"
          onClick={onClose}
          className="w-full mt-3 py-2.5 rounded-xl text-gray-500 text-sm hover:text-gray-300 transition"
        >
          Peut-être plus tard
        </button>
      </div>
    </div>
  );
}
