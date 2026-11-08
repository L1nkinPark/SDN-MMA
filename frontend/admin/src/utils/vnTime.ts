import type { BookingAction } from '../api/types';

/**
 * Bookings, opening hours and closed dates are Vietnam time (Asia/Ho_Chi_Minh, UTC+7, no daylight
 * saving), whatever time zone the browser uses. The backend checks them in that zone.
 */

const VN_OFFSET_MS = 7 * 3600000;

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/** "2026-11-04" for the Vietnam calendar day of an instant. */
export function vnDateKey(date: Date = new Date()): string {
  const shifted = new Date(date.getTime() + VN_OFFSET_MS);
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

/** ISO instant -> "04/11/2026 10:00" in Vietnam time. */
export function vnDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const shifted = new Date(date.getTime() + VN_OFFSET_MS);
  return `${pad(shifted.getUTCDate())}/${pad(shifted.getUTCMonth() + 1)}/${shifted.getUTCFullYear()} ${pad(
    shifted.getUTCHours(),
  )}:${pad(shifted.getUTCMinutes())}`;
}

/** "2026-11-04" -> "04/11/2026" */
export function dateKeyLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split('-');
  return `${day}/${month}/${year}`;
}

/** The last date the backend accepts for a closed date: about one year ahead. */
export function latestClosedDate(now: Date = new Date()): string {
  return new Date(now.getTime() + 365 * 86400000).toISOString().slice(0, 10);
}

/** What a merchant may do with a booking right now, mirroring the time checks in `merchantDecision`. */
export function bookingActionsAt(status: string | undefined, startsAt: string | undefined, now: number = Date.now(), holdUntil?: string | null): BookingAction[] {
  const start = startsAt ? Date.parse(startsAt) : NaN;
  if (Number.isNaN(start)) return [];
  const window = 15 * 60000;
  if (status === 'pending') return now < start && now < (holdUntil ? Date.parse(holdUntil) : start - 3600000) ? ['approve', 'reject'] : [];
  if (status !== 'confirmed') return [];
  const actions: BookingAction[] = [];
  if (now >= start - window && now <= start + window) actions.push('arrived');
  if (now < start) actions.push('cancel');
  if (now >= start + window) actions.push('no_show');
  return actions;
}
