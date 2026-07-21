import { useTranslation } from 'react-i18next';

type SettingsAccordionSectionProps = {
  id: string;
  title: string;
  summary?: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  /** Nested accordion inside a parent panel (e.g. legal sub-groups). */
  nested?: boolean;
};

export function SettingsAccordionSection({
  id,
  title,
  summary,
  expanded,
  onToggle,
  children,
  nested = false,
}: SettingsAccordionSectionProps) {
  const { t } = useTranslation();
  const panelId = `${id}-panel`;

  return (
    <section className={nested ? 'mt-2 mx-0 mb-0' : 'mx-4 mb-2'}>
      <div
        className={`overflow-hidden border border-[#1e1e2f] bg-[#12121a]/40 ${
          nested ? 'rounded-lg' : 'rounded-xl'
        }`}
      >
        <button
          type="button"
          id={id}
          aria-expanded={expanded}
          aria-controls={panelId}
          aria-label={
            expanded
              ? t('settings.sectionCollapse', { label: title, defaultValue: `Replier ${title}` })
              : t('settings.sectionExpand', { label: title, defaultValue: `Déplier ${title}` })
          }
          onClick={onToggle}
          className={`w-full flex items-center justify-between gap-3 min-h-[44px] text-left transition-colors hover:bg-[#12121a]/70 active:bg-[#12121a] ${
            nested ? 'px-3 py-2.5' : 'px-4 py-3'
          }`}
        >
          <div className="min-w-0 flex-1">
            <p
              className={`font-bold uppercase tracking-wider text-gray-400 ${
                nested ? 'text-[9px]' : 'text-[10px]'
              }`}
            >
              {title}
            </p>
            {!expanded && summary ? (
              <p className="text-[11px] text-gray-500 mt-0.5 truncate">{summary}</p>
            ) : null}
          </div>
          <span className="flex items-center gap-2 shrink-0">
            {expanded && summary ? (
              <span className="hidden sm:inline text-[10px] text-gray-600 truncate max-w-[8rem]">{summary}</span>
            ) : null}
            <svg
              className={`w-3.5 h-3.5 text-gray-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              aria-hidden
            >
              <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </button>

        {expanded ? (
          <div
            id={panelId}
            role="region"
            aria-labelledby={id}
            className={`border-t border-[#1e1e2f]/80 ${nested ? 'px-3 pb-3 pt-2' : 'px-4 pb-4 pt-1'}`}
          >
            {children}
          </div>
        ) : null}
      </div>
    </section>
  );
}
