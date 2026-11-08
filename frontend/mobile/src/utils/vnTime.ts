/**
 * Booking dates and times are always Vietnam time (Asia/Ho_Chi_Minh, UTC+7, no daylight saving),
 * whatever time zone the phone uses. The backend checks opening hours and closed dates in that zone.
 */

const VN_OFFSET_MS = 7 * 3600000;
const DAY_MS = 86400000;

export const WEEKDAY_LABELS = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'] as const;
export const WEEKDAY_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'] as const;

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/** The same instant shifted so its UTC fields read as Vietnam wall-clock time. */
function vnClock(date: Date): Date {
  return new Date(date.getTime() + VN_OFFSET_MS);
}

/** "2026-11-04" for the Vietnam calendar day of an instant. */
export function vnDateKey(date: Date = new Date()): string {
  const shifted = vnClock(date);
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

/** 0 = Sunday, as in the backend's `openingHours.day`. */
export function weekdayOf(dateKey: string): number {
  return new Date(`${dateKey}T12:00:00Z`).getUTCDay();
}

/** The instant of a Vietnam date and "HH:mm" clock time. */
export function vnInstant(dateKey: string, clock: string): Date {
  return new Date(`${dateKey}T${clock}:00+07:00`);
}

/** Today and the following days as date keys, in Vietnam time. */
export function nextDateKeys(count: number, now: Date = new Date()): string[] {
  const today = new Date(`${vnDateKey(now)}T12:00:00Z`).getTime();
  return Array.from({ length: count }, (_, index) => new Date(today + index * DAY_MS).toISOString().slice(0, 10));
}

/** "T4 04/11" */
export function shortDateLabel(dateKey: string): string {
  const [, month, day] = dateKey.split('-');
  return `${WEEKDAY_SHORT[weekdayOf(dateKey)]} ${day}/${month}`;
}

/** "Thứ tư, 04/11/2026" */
export function longDateLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split('-');
  return `${WEEKDAY_LABELS[weekdayOf(dateKey)]}, ${day}/${month}/${year}`;
}

/** ISO instant -> "16:40" in Vietnam time. */
export function vnTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const shifted = vnClock(date);
  return `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`;
}

/** ISO instant -> "Thứ tư, 04/11/2026 · 10:00" in Vietnam time. */
export function vnDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${longDateLabel(vnDateKey(date))} · ${vnTime(iso)}`;
}

function minutesOf(clock: string): number {
  const [hours, minutes] = clock.split(':').map(Number);
  return hours * 60 + minutes;
}

function clockOf(minutes: number): string {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/**
 * Start times the backend accepts for one day, mirroring `ensureBookable`: a 30 or 60 minute slot
 * starts on the hour or half hour it divides, a 120 minute slot starts on an even hour, and the
 * slot must end by closing time.
 */
export function slotStartTimes(open: string, close: string, slotMinutes: number): string[] {
  const step = Math.min(slotMinutes, 60);
  const opening = minutesOf(open);
  const closing = minutesOf(close);
  const result: string[] = [];
  for (let start = 0; start + slotMinutes <= closing; start += step) {
    if (start < opening) continue;
    if (slotMinutes === 120 && (start / 60) % 2 !== 0) continue;
    result.push(clockOf(start));
  }
  return result;
}

/** The backend accepts a booking from 1 hour to 14 days ahead. */
export const BOOKING_MIN_LEAD_MS = 3600000;
export const BOOKING_MAX_AHEAD_MS = 14 * DAY_MS;
/** Guests may cancel until 1 hour before the start. */
export const CANCEL_LEAD_MS = 3600000;

export function isBookableStart(start: Date, now: number = Date.now()): boolean {
  const time = start.getTime();
  return time >= now + BOOKING_MIN_LEAD_MS && time <= now + BOOKING_MAX_AHEAD_MS;
}
