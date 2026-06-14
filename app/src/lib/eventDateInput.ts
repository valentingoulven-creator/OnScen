import { usesEuropeanDateFormat } from './profileAge';

/** Valeur interne compatible `new Date()` : YYYY-MM-DDTHH:mm */
export type EventDateLocalValue = string;

const LOCAL_DT_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const DISPLAY_DT_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/;

export function getEventDatePlaceholder(locale?: string): string {
  return usesEuropeanDateFormat(locale) ? 'jj/mm/aaaa --:--' : 'mm/dd/yyyy --:--';
}

export function formatEventDateInputValue(isoLocal: string, locale?: string): string {
  const match = LOCAL_DT_RE.exec(isoLocal.trim());
  if (!match) return '';
  const [, year, month, day, hour, minute] = match;
  if (usesEuropeanDateFormat(locale)) {
    return `${day}/${month}/${year} ${hour}:${minute}`;
  }
  return `${month}/${day}/${year} ${hour}:${minute}`;
}

export function parseEventDateInputValue(text: string, locale?: string): EventDateLocalValue | null {
  const trimmed = text.trim();
  const isoMatch = LOCAL_DT_RE.exec(trimmed);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    const hour = Number(isoMatch[4]);
    const minute = Number(isoMatch[5]);
    const date = new Date(year, month - 1, day, hour, minute);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day ||
      date.getHours() !== hour ||
      date.getMinutes() !== minute
    ) {
      return null;
    }
    return trimmed as EventDateLocalValue;
  }

  const match = DISPLAY_DT_RE.exec(trimmed);
  if (!match) return null;

  const partA = Number(match[1]);
  const partB = Number(match[2]);
  const year = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);

  let day: number;
  let month: number;
  if (usesEuropeanDateFormat(locale)) {
    day = partA;
    month = partB;
  } else {
    month = partA;
    day = partB;
  }

  if (
    !Number.isInteger(day) ||
    !Number.isInteger(month) ||
    !Number.isInteger(year) ||
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  const date = new Date(year, month - 1, day, hour, minute);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute
  ) {
    return null;
  }

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function isEventDateInFuture(isoLocal: string): boolean {
  if (!LOCAL_DT_RE.test(isoLocal.trim())) return false;
  const date = new Date(isoLocal);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  now.setSeconds(0, 0);
  return date.getTime() >= now.getTime();
}
