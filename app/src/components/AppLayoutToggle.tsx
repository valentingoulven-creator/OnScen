import { resetAppLayout, setAppLayout, type AppLayoutId } from '../lib/appLayout';

interface AppLayoutToggleProps {
  layout: AppLayoutId;
  onLayoutChange: (layout: AppLayoutId) => void;
}

export function AppLayoutToggle({ layout, onLayoutChange }: AppLayoutToggleProps) {
  const isAppa2 = layout === 'appa2';

  const cycle = () => {
    if (isAppa2) {
      resetAppLayout();
      onLayoutChange('default');
      return;
    }
    const next: AppLayoutId = 'appa2';
    setAppLayout(next);
    onLayoutChange(next);
  };

  return (
    <button
      type="button"
      onClick={cycle}
      title={
        isAppa2
          ? 'Réinitialiser la disposition classique (bandeau pub réaffiché)'
          : 'Disposition classique (cliquer pour appa2)'
      }
      aria-label={
        isAppa2
          ? 'Réinitialiser la disposition classique et réafficher le bandeau pub'
          : 'Passer à la disposition appa2'
      }
      className={`shrink-0 flex items-center justify-center w-8 h-8 rounded-lg border text-[10px] font-bold uppercase tracking-wide transition active:scale-95 ${
        isAppa2
          ? 'border-pink-500/50 bg-pink-500/15 text-pink-300'
          : 'border-[var(--ms-border)] bg-[var(--ms-surface-elevated)] text-[var(--ms-text-muted)] hover:text-[var(--ms-text)] hover:border-purple-500/40'
      }`}
    >
      {isAppa2 ? 'a2' : '◫'}
    </button>
  );
}
