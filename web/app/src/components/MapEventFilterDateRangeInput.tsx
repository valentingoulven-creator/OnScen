import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

function toYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseYmd(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return new Date(year, month - 1, day);
}

function compareYmd(a: string, b: string): number {
  return a.localeCompare(b);
}

function normalizeRange(from: string, to: string): { dateFrom: string; dateTo: string } {
  if (!from.trim()) return { dateFrom: '', dateTo: '' };
  if (!to.trim()) return { dateFrom: from, dateTo: '' };
  if (compareYmd(to, from) < 0) return { dateFrom: to, dateTo: from };
  return { dateFrom: from, dateTo: to };
}

interface Props {
  dateFrom: string;
  dateTo: string;
  onChange: (next: { dateFrom: string; dateTo: string }) => void;
  idPrefix?: string;
  disabled?: boolean;
  /** Bandeau browse : calendrier compact, largeur fixe. */
  compact?: boolean;
  /** Browse inline : trigger mini + calendrier en popover. */
  minimal?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function MapEventFilterDateRangeInput({
  dateFrom,
  dateTo,
  onChange,
  idPrefix = 'map-event-filter-date',
  disabled,
  compact = false,
  minimal = false,
  onOpenChange,
}: Props) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [pendingFrom, setPendingFrom] = useState<string | null>(null);
  const [calMonth, setCalMonth] = useState(() => {
    const seed = parseYmd(dateFrom) ?? new Date();
    return new Date(seed.getFullYear(), seed.getMonth(), 1);
  });

  const locale = i18n.language.startsWith('fr') ? 'fr-FR' : 'en-US';

  const formatDay = useMemo(() => {
    if (minimal) {
      return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' });
    }
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }, [locale, minimal]);

  const monthTitle = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(calMonth),
    [calMonth, locale]
  );

  const weekdayLabels = useMemo(() => {
    const base = new Date(2024, 0, 1); // Monday
    return Array.from({ length: 7 }, (_, i) =>
      new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(
        new Date(base.getFullYear(), base.getMonth(), base.getDate() + i)
      )
    );
  }, [locale]);

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) {
      setPendingFrom(null);
      return;
    }
    const seed = parseYmd(dateFrom) ?? parseYmd(dateTo) ?? new Date();
    setCalMonth(new Date(seed.getFullYear(), seed.getMonth(), 1));
  }, [open, dateFrom, dateTo]);

  const displayLabel = (() => {
    const from = dateFrom.trim();
    const to = dateTo.trim();
    if (!from && !to) return t('map.eventFilterDatePlaceholder');
    const fromDate = parseYmd(from);
    if (!fromDate) return t('map.eventFilterDatePlaceholder');
    if (!to.trim()) {
      return t('map.eventFilterDateFromOnly', { date: formatDay.format(fromDate) });
    }
    const toDate = parseYmd(to);
    if (!toDate) return t('map.eventFilterDateFromOnly', { date: formatDay.format(fromDate) });
    return t('map.eventFilterDateRange', {
      from: formatDay.format(fromDate),
      to: formatDay.format(toDate),
    });
  })();

  const year = calMonth.getFullYear();
  const month = calMonth.getMonth();
  const startOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayYmd = toYmd(new Date());

  const effectiveFrom = pendingFrom ?? dateFrom.trim();
  const effectiveTo = pendingFrom ? '' : dateTo.trim();

  const cells: (number | null)[] = [
    ...Array.from<unknown, null>({ length: startOffset }, () => null),
    ...Array.from<unknown, number>({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function dayYmd(day: number): string {
    return `${String(year).padStart(4, '0')}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  function handlePickDay(ymd: string) {
    if (!pendingFrom) {
      setPendingFrom(ymd);
      onChange({ dateFrom: ymd, dateTo: '' });
      return;
    }
    const range = normalizeRange(pendingFrom, ymd);
    onChange(range);
    setPendingFrom(null);
  }

  function handleConfirm() {
    if (pendingFrom) {
      onChange({ dateFrom: pendingFrom, dateTo: '' });
      setPendingFrom(null);
    }
    setOpen(false);
  }

  const toggleOpen = () => {
    if (disabled) return;
    setOpen((v) => !v);
  };

  const isCompactUi = compact || minimal;
  const calendarWidth = minimal
    ? 'w-[15.5rem] max-w-[calc(100vw-2rem)]'
    : compact
      ? 'w-[16.25rem] max-w-full'
      : 'w-full min-w-[16.25rem] max-w-sm';
  const dayCellClass = isCompactUi ? 'h-7 text-[11px] rounded-md' : 'h-9 text-xs rounded-lg';
  const emptyCellClass = isCompactUi ? 'h-7' : 'h-9';
  const navBtnClass = isCompactUi ? 'w-8 h-8 rounded-md text-base' : 'w-11 h-11 rounded-lg text-lg';

  return (
    <div className={isCompactUi ? 'relative' : undefined}>
      <button
        id={`${idPrefix}-trigger`}
        type="button"
        disabled={disabled}
        onClick={toggleOpen}
        aria-expanded={open}
        aria-controls={`${idPrefix}-calendar`}
        aria-label={t('map.eventFilterDateLabel')}
        className={`w-full flex items-center gap-1.5 rounded-md bg-[#0b0b0f] border border-[#2a2a3d] text-left hover:border-purple-500/40 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition disabled:opacity-40 touch-manipulation ${
          minimal
            ? 'px-2 py-1.5 min-h-8 text-[11px]'
            : compact
              ? 'px-2.5 py-2 min-h-[40px] text-sm'
              : 'px-3 py-2.5 min-h-[44px] text-sm'
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          className={`${minimal ? 'w-3 h-3' : 'w-4 h-4'} shrink-0 text-purple-400`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <rect x="3" y="4" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 2v4M8 2v4M3 10h18" />
        </svg>
        <span className={`flex-1 min-w-0 truncate ${dateFrom.trim() ? 'text-white' : 'text-gray-500'}`}>
          {displayLabel}
        </span>
        <svg
          viewBox="0 0 24 24"
          className={`${minimal ? 'w-3 h-3' : 'w-3.5 h-3.5'} shrink-0 text-gray-500 transition ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open ? (
        <div
          id={`${idPrefix}-calendar`}
          role="dialog"
          aria-label={t('map.eventFilterDateLabel')}
          className={`${calendarWidth} rounded-lg bg-[#12121a] border border-purple-500/25 p-2 shadow-lg shadow-black/40 ${
            minimal ? 'absolute left-0 top-full z-50 mt-1' : compact ? 'mt-1.5' : 'mt-2'
          }`}
        >
          <div className="flex items-center justify-between gap-1 mb-1.5">
            <button
              type="button"
              onClick={() => setCalMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
              className={`${navBtnClass} flex items-center justify-center text-gray-400 hover:text-white hover:bg-purple-500/20 transition leading-none touch-manipulation`}
              aria-label={t('map.eventFilterDatePrevMonth')}
            >
              ‹
            </button>
            <span className="text-xs font-semibold text-white capitalize select-none text-center px-1 truncate">
              {monthTitle}
            </span>
            <button
              type="button"
              onClick={() => setCalMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
              className={`${navBtnClass} flex items-center justify-center text-gray-400 hover:text-white hover:bg-purple-500/20 transition leading-none touch-manipulation`}
              aria-label={t('map.eventFilterDateNextMonth')}
            >
              ›
            </button>
          </div>

          {(pendingFrom || !dateTo.trim()) && (
            <p className="text-[9px] leading-snug text-gray-500 mb-1.5">
              {pendingFrom ? t('map.eventFilterDateHintEnd') : t('map.eventFilterDateHint')}
            </p>
          )}

          <div className="grid grid-cols-7 gap-px mb-0.5">
            {weekdayLabels.map((d, i) => (
              <div
                key={`${d}-${i}`}
                className="h-5 flex items-center justify-center text-[9px] font-semibold text-gray-600"
              >
                {d.replace(/\.$/, '')}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-px">
            {cells.map((day, i) => {
              if (day === null) return <div key={`_${i}`} aria-hidden className={emptyCellClass} />;

              const ymd = dayYmd(day);
              const isToday = ymd === todayYmd;
              const isPending = pendingFrom === ymd;
              const isStart = effectiveFrom === ymd;
              const isEnd = effectiveTo === ymd;
              const inRange =
                effectiveFrom &&
                effectiveTo &&
                compareYmd(ymd, effectiveFrom) >= 0 &&
                compareYmd(ymd, effectiveTo) <= 0;

              let cls = `${dayCellClass} w-full font-medium transition select-none touch-manipulation `;
              if (isStart || isEnd || isPending) {
                cls += 'bg-purple-600 text-white';
              } else if (inRange) {
                cls += 'bg-purple-600/25 text-purple-100';
              } else if (isToday) {
                cls += 'ring-1 ring-inset ring-purple-500/60 text-purple-200 hover:bg-purple-500/20';
              } else {
                cls += 'text-gray-300 hover:bg-purple-500/25 hover:text-white';
              }

              return (
                <button
                  key={ymd}
                  type="button"
                  onClick={() => handlePickDay(ymd)}
                  aria-pressed={isStart || isEnd || isPending || Boolean(inRange)}
                  className={cls}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={!dateFrom.trim() && !pendingFrom}
            className="mt-1.5 w-full min-h-9 py-1.5 rounded-md text-xs font-bold bg-purple-600/70 border border-purple-400/50 text-white hover:bg-purple-600 transition disabled:opacity-40 disabled:pointer-events-none touch-manipulation"
          >
            {t('map.eventFilterDateOk')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
