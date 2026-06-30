import { useEffect, useRef, useState } from 'react';
import { isEventDateInFuture } from '../lib/eventDateInput';

const DAY_LABELS = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'];
const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

interface Props {
  /** Already-confirmed ISO local start strings e.g. "2024-07-15T20:00" — highlighted green. */
  confirmedDates: string[];
  onAddDate: (isoStart: string, isoEnd: string | null) => void;
  disabled?: boolean;
}

export function EventDatePickerInput({ confirmedDates, onAddDate, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [pickedDay, setPickedDay] = useState<Date | null>(null);
  const [timeValue, setTimeValue] = useState('');
  const [timeError, setTimeError] = useState<string | null>(null);
  const [endTimeValue, setEndTimeValue] = useState('');
  const [endTimeError, setEndTimeError] = useState<string | null>(null);

  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const timeInputRef = useRef<HTMLInputElement>(null);
  const endTimeInputRef = useRef<HTMLInputElement>(null);

  // Close popover on outside click
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (
        !popoverRef.current?.contains(e.target as Node) &&
        !triggerRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const year = calMonth.getFullYear();
  const month = calMonth.getMonth(); // 0-indexed

  // Monday-first week offset: Sun(0)→6, Mon(1)→0, Tue(2)→1 …
  const startOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);
  const todayYMD = toYMD(todayMidnight);
  const confirmedYMDs = new Set(confirmedDates.map((d) => d.split('T')[0]));

  function toYMD(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function dayYMD(day: number): string {
    return `${String(year).padStart(4, '0')}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  function buildIsoLocal(day: Date, h: number, m: number): string {
    return [
      String(day.getFullYear()).padStart(4, '0'),
      '-',
      String(day.getMonth() + 1).padStart(2, '0'),
      '-',
      String(day.getDate()).padStart(2, '0'),
      'T',
      String(h).padStart(2, '0'),
      ':',
      String(m).padStart(2, '0'),
    ].join('');
  }

  function handlePickDay(day: number) {
    setPickedDay(new Date(year, month, day));
    setTimeError(null);
    setEndTimeError(null);
    // Default to next round hour
    const h = (new Date().getHours() + 1) % 24;
    setTimeValue(`${String(h).padStart(2, '0')}:00`);
    setEndTimeValue('');
    setTimeout(() => timeInputRef.current?.focus(), 60);
  }

  function handleConfirm() {
    if (!pickedDay || !timeValue) {
      setTimeError('Veuillez saisir une heure');
      return;
    }
    const [hStr, mStr] = timeValue.split(':');
    const h = Number(hStr);
    const m = Number(mStr);
    if (Number.isNaN(h) || Number.isNaN(m) || h > 23 || m > 59) {
      setTimeError('Heure invalide');
      return;
    }

    // Validate optional end time
    let endIsoLocal: string | null = null;
    if (endTimeValue.trim()) {
      const [ehStr, emStr] = endTimeValue.split(':');
      const eh = Number(ehStr);
      const em = Number(emStr);
      if (Number.isNaN(eh) || Number.isNaN(em) || eh > 23 || em > 59) {
        setEndTimeError('Heure invalide');
        return;
      }
      if (eh < h || (eh === h && em <= m)) {
        setEndTimeError("L'heure de fin doit être après le début");
        return;
      }
      endIsoLocal = buildIsoLocal(pickedDay, eh, em);
    }

    const isoLocal = buildIsoLocal(pickedDay, h, m);
    if (!isEventDateInFuture(isoLocal)) {
      setTimeError('La date doit être dans le futur');
      return;
    }
    onAddDate(isoLocal, endIsoLocal);
    setOpen(false);
    setPickedDay(null);
    setTimeValue('');
    setEndTimeValue('');
    setTimeError(null);
    setEndTimeError(null);
  }

  const hasConfirmed = confirmedDates.length > 0;
  const cells: (number | null)[] = [
    ...Array.from<unknown, null>({ length: startOffset }, () => null),
    ...Array.from<unknown, number>({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="relative">
      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => { if (!disabled) setOpen((v) => !v); }}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={hasConfirmed ? 'Ajouter une autre date' : 'Choisir une date et une heure'}
        className="w-full flex items-center gap-2 rounded-lg bg-[#0b0b0f] border border-[#2a2a3d] px-3 py-2 text-sm text-left hover:border-purple-500/40 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition disabled:opacity-40"
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0 text-purple-400" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 2v4M8 2v4M3 10h18" />
        </svg>
        <span className={hasConfirmed ? 'text-purple-300' : 'text-gray-500'}>
          {hasConfirmed ? '+ Ajouter une date' : 'Choisir une date et une heure'}
        </span>
      </button>

      {/* Calendar popover */}
      {open && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="Calendrier"
          className="absolute z-50 left-0 top-full mt-1.5 w-full min-w-[272px] rounded-xl bg-[#12121a] border border-purple-500/25 shadow-2xl shadow-black/60 p-3"
        >
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-2.5">
            <button
              type="button"
              onClick={() => setCalMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-purple-500/20 transition text-lg leading-none"
              aria-label="Mois précédent"
            >
              ‹
            </button>
            <span className="text-sm font-semibold text-white capitalize select-none">
              {MONTH_NAMES[month]} {year}
            </span>
            <button
              type="button"
              onClick={() => setCalMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-purple-500/20 transition text-lg leading-none"
              aria-label="Mois suivant"
            >
              ›
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAY_LABELS.map((d) => (
              <div key={d} className="text-center text-[9px] font-bold text-gray-600 uppercase py-0.5">
                {d}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((day, i) => {
              if (day === null) return <div key={`_${i}`} />;
              const ymd = dayYMD(day);
              const past = new Date(year, month, day) < todayMidnight;
              const isToday = ymd === todayYMD;
              const isAlreadyAdded = confirmedYMDs.has(ymd);
              const isPicked =
                pickedDay !== null &&
                pickedDay.getDate() === day &&
                pickedDay.getMonth() === month &&
                pickedDay.getFullYear() === year;

              let cls = 'h-8 w-full rounded-lg text-xs font-medium transition select-none ';
              if (past) {
                cls += 'text-gray-700 cursor-default';
              } else if (isPicked) {
                cls += 'bg-purple-600 text-white';
              } else if (isAlreadyAdded) {
                cls += 'bg-green-500/20 text-green-300 hover:bg-green-500/35';
              } else if (isToday) {
                cls += 'ring-1 ring-inset ring-purple-500/60 text-purple-200 hover:bg-purple-500/20';
              } else {
                cls += 'text-gray-300 hover:bg-purple-500/25 hover:text-white';
              }

              return (
                <button
                  key={ymd}
                  type="button"
                  disabled={past}
                  onClick={() => handlePickDay(day)}
                  aria-pressed={isPicked}
                  className={cls}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Time pickers — appear after a day is chosen */}
          {pickedDay !== null && (
            <div className="mt-3 pt-3 border-t border-purple-500/20 space-y-2.5">
              {/* Start time */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold text-purple-300 uppercase tracking-wide">
                  Heure de l&apos;événement
                </p>
                <div className="flex gap-2 items-stretch">
                  <input
                    ref={timeInputRef}
                    type="time"
                    value={timeValue}
                    onChange={(e) => { setTimeValue(e.target.value); setTimeError(null); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') endTimeInputRef.current?.focus(); }}
                    className={`flex-1 rounded-lg bg-[#0b0b0f] border px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 ${
                      timeError
                        ? 'border-red-500/60 focus:ring-red-500/40'
                        : 'border-[#2a2a3d] focus:ring-purple-500/50'
                    }`}
                  />
                </div>
                {timeError && (
                  <p className="text-[10px] text-red-400" role="alert">{timeError}</p>
                )}
              </div>

              {/* End time (optional) */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Heure de fin <span className="normal-case font-normal text-gray-600">(optionnel)</span>
                </p>
                <div className="flex gap-2 items-stretch">
                  <input
                    ref={endTimeInputRef}
                    type="time"
                    value={endTimeValue}
                    placeholder="--:--"
                    onChange={(e) => { setEndTimeValue(e.target.value); setEndTimeError(null); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm(); }}
                    className={`flex-1 rounded-lg bg-[#0b0b0f] border px-3 py-2 text-sm text-white placeholder:text-gray-700 focus:outline-none focus:ring-2 ${
                      endTimeError
                        ? 'border-red-500/60 focus:ring-red-500/40'
                        : 'border-[#2a2a3d] focus:ring-purple-500/50'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={handleConfirm}
                    className="shrink-0 rounded-lg px-3 py-2 text-xs font-semibold bg-purple-600/45 border border-purple-400/50 text-purple-100 hover:bg-purple-600/65 transition"
                  >
                    Valider
                  </button>
                </div>
                {endTimeError && (
                  <p className="text-[10px] text-red-400" role="alert">{endTimeError}</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
