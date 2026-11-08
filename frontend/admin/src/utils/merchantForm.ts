import type { MerchantPlaceUpdate, OpeningHours, Place } from '../api/types';
import { parseCount, parsePrice } from './validation';
import { vnDateKey } from './vnTime';

export type Amenity = boolean | null;
export type SlotMinutes = 30 | 60 | 120;
export type DayHours = { day: number; open: boolean; from: string; to: string };

/** Everything a merchant edits on the "Vận hành" tab, as form text. */
export type SettingsValues = {
  phone: string;
  seatingCapacity: string;
  wifi: Amenity;
  outlets: Amenity;
  price: string;
  temporaryClosed: boolean;
  bookingEnabled: boolean;
  approvalMode: 'auto' | 'manual';
  slotMinutes: SlotMinutes;
  capacityPerSlot: string;
  hours: DayHours[];
  closedDates: string[];
};

export type SettingsField = 'phone' | 'seatingCapacity' | 'price' | 'capacityPerSlot' | 'hours' | 'closedDates';
export type SettingsErrors = Partial<Record<SettingsField, string>>;

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_CLOSED_DATES = 90;

/** Closed dates before today are history; the backend refuses them in an update. */
export function upcomingDates(dates: string[] | undefined, today: string = vnDateKey()): string[] {
  return [...new Set((dates ?? []).filter((date) => date >= today))].sort();
}

export function settingsFromPlace(place: Place, today?: string): SettingsValues {
  const business = place.business;
  const booking = place.booking;
  const stored = business?.openingHours ?? [];
  return {
    phone: business?.phone ?? '',
    seatingCapacity: business?.seatingCapacity ? String(business.seatingCapacity) : '',
    wifi: place.amenities?.wifi ?? null,
    outlets: place.amenities?.outlets ?? null,
    price: typeof place.minDrinkPrice === 'number' ? String(place.minDrinkPrice) : '',
    temporaryClosed: Boolean(business?.temporaryClosed),
    bookingEnabled: Boolean(booking?.enabled),
    approvalMode: booking?.approvalMode === 'manual' ? 'manual' : 'auto',
    slotMinutes: booking?.slotMinutes === 30 || booking?.slotMinutes === 120 ? booking.slotMinutes : 60,
    capacityPerSlot: booking?.capacityPerSlot ? String(booking.capacityPerSlot) : '',
    hours: Array.from({ length: 7 }, (_, day) => {
      const found = stored.find((item) => item.day === day);
      return { day, open: Boolean(found), from: found?.open ?? '08:00', to: found?.close ?? '22:00' };
    }),
    closedDates: upcomingDates(business?.closedDates, today),
  };
}

function hoursOf(values: SettingsValues): OpeningHours[] {
  return values.hours.filter((item) => item.open).map((item) => ({ day: item.day, open: item.from, close: item.to }));
}

function sameHours(a: OpeningHours[], b: OpeningHours[]): boolean {
  const key = (list: OpeningHours[]) =>
    [...list]
      .sort((x, y) => (x.day ?? 0) - (y.day ?? 0))
      .map((item) => `${item.day}:${item.open}-${item.close}`)
      .join('|');
  return key(a) === key(b);
}

export function validateSettings(values: SettingsValues): SettingsErrors {
  const errors: SettingsErrors = {};
  const phone = values.phone.trim();
  if (phone && (phone.length < 8 || phone.length > 20)) errors.phone = 'Số điện thoại cần 8 đến 20 ký tự.';
  const seating = parseCount(values.seatingCapacity);
  if (seating === undefined) errors.seatingCapacity = 'Số ghế là số nguyên từ 1 đến 10.000.';
  if (parsePrice(values.price) === undefined) errors.price = 'Giá cần là số đồng, ví dụ 25.000.';
  const capacity = parseCount(values.capacityPerSlot);
  if (capacity === undefined) errors.capacityPerSlot = 'Số chỗ là số nguyên từ 1 đến 10.000.';
  else if (values.bookingEnabled && capacity === null) errors.capacityPerSlot = 'Cần số chỗ mỗi khung giờ để nhận đặt chỗ.';
  else if (values.bookingEnabled && seating != null && capacity != null && capacity > seating) {
    errors.capacityPerSlot = 'Số chỗ mỗi khung giờ không được vượt quá tổng số ghế của quán.';
  }
  const open = values.hours.filter((item) => item.open);
  if (open.some((item) => !CLOCK.test(item.from) || !CLOCK.test(item.to))) {
    errors.hours = 'Giờ cần theo dạng HH:mm, ví dụ 08:00.';
  } else if (open.some((item) => item.from >= item.to)) {
    errors.hours = 'Giờ mở cửa phải trước giờ đóng cửa (quán mở qua nửa đêm chưa được hỗ trợ).';
  } else if (values.bookingEnabled && open.length === 0) {
    errors.hours = 'Chọn ít nhất một ngày mở cửa để nhận đặt chỗ.';
  }
  if (values.closedDates.length > MAX_CLOSED_DATES) errors.closedDates = `Tối đa ${MAX_CLOSED_DATES} ngày nghỉ.`;
  return errors;
}

/** Only the fields that changed, in the shape `PATCH /api/merchant/places/{id}` takes. */
export function settingsChanges(place: Place, values: SettingsValues, today?: string): MerchantPlaceUpdate {
  const before = settingsFromPlace(place, today);
  const changes: MerchantPlaceUpdate = {};
  const phone = values.phone.trim() || null;
  if (phone !== (before.phone.trim() || null)) changes.phone = phone;
  const seating = parseCount(values.seatingCapacity) ?? null;
  if (seating !== (place.business?.seatingCapacity ?? null)) changes.seatingCapacity = seating;
  if (values.wifi !== before.wifi) changes.wifi = values.wifi;
  if (values.outlets !== before.outlets) changes.outlets = values.outlets;
  const price = parsePrice(values.price) ?? null;
  if (price !== (place.minDrinkPrice ?? null)) changes.minDrinkPrice = price;
  if (values.temporaryClosed !== before.temporaryClosed) changes.temporaryClosed = values.temporaryClosed;
  if (values.bookingEnabled !== before.bookingEnabled) changes.bookingEnabled = values.bookingEnabled;
  if (values.approvalMode !== before.approvalMode) changes.approvalMode = values.approvalMode;
  if (values.slotMinutes !== before.slotMinutes) changes.slotMinutes = values.slotMinutes;
  const capacity = parseCount(values.capacityPerSlot) ?? null;
  if (capacity !== (place.booking?.capacityPerSlot ?? null)) changes.capacityPerSlot = capacity;
  const hours = hoursOf(values);
  if (!sameHours(hours, place.business?.openingHours ?? [])) {
    changes.openingHours = hours.map((item) => ({ day: item.day as number, open: item.open as string, close: item.close as string }));
  }
  const dates = upcomingDates(values.closedDates, today);
  if (dates.join(',') !== before.closedDates.join(',')) changes.closedDates = dates;
  return changes;
}
