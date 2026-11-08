import { api } from './client';
import type {
  Availability,
  BookingPlace,
  BookingStatus,
  CancelBookingResponse,
  CreateBookingInput,
  CreateBookingResponse,
  MyBooking,
  MyBookingPage,
} from './types';

export const BOOKINGS_PAGE_SIZE = 20;
/** The backend keeps at most 3 pending or confirmed bookings in the future per user. */
export const MAX_UPCOMING_BOOKINGS = 3;
export const MAX_PARTY_SIZE = 20;
export const NOTE_MAX_LENGTH = 500;

const enc = encodeURIComponent;

export const bookingsApi = {
  availability: (placeId: string, date: string) =>
    api.request<Availability>(`/api/places/${enc(placeId)}/availability`, { query: { date } }),
  create: (input: CreateBookingInput) =>
    api.request<CreateBookingResponse>('/api/bookings', { method: 'POST', body: input }),
  listMine: (page: number, limit = BOOKINGS_PAGE_SIZE) =>
    api.request<MyBookingPage>('/api/bookings/me', { query: { page, limit } }),
  cancel: (id: string) => api.request<CancelBookingResponse>(`/api/bookings/${enc(id)}/cancel`, { method: 'POST' }),
};

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  pending: 'Chờ quán xác nhận',
  confirmed: 'Đã xác nhận',
  cancelled: 'Đã hủy',
  completed: 'Đã đến quán',
  no_show: 'Không đến',
};

export function bookingStatusLabel(status: BookingStatus | undefined): string {
  return BOOKING_STATUS_LABELS[status ?? 'pending'];
}

/** Pending and confirmed bookings still hold a seat. */
export function isActiveBooking(booking: Pick<MyBooking, 'status'>): boolean {
  return booking.status === 'pending' || booking.status === 'confirmed';
}

/** `place` is populated on `GET /api/bookings/me`; it can be null when the place was removed. */
export function bookingPlace(booking: MyBooking): BookingPlace | null {
  return booking.place && typeof booking.place === 'object' ? booking.place : null;
}
