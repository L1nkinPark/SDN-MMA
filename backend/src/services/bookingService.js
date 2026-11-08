import { Booking, BookingSlot, BookingUserWindow } from '../models/index.js';
import { HttpError } from '../utils/common.js';

export function localVisitTime(date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(date).map(part => [part.type, part.value]));
  return { day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday),
    date: `${parts.year}-${parts.month}-${parts.day}`, clock: `${parts.hour}:${parts.minute}`, minute: Number(parts.minute) };
}

export function ensureBookable(place, startsAt) {
  if (!place || place.approval !== 'approved') throw new HttpError(404, 'Place not found');
  if (!place.booking?.enabled || place.business?.temporaryClosed) throw new HttpError(409, 'Booking unavailable');
  const capacity = place.booking.capacityPerSlot;
  if (!Number.isInteger(capacity) || capacity < 1) throw new HttpError(409, 'Booking capacity not configured');
  if (place.business?.seatingCapacity != null && capacity > place.business.seatingCapacity) {
    throw new HttpError(409, 'Booking capacity exceeds the place seating capacity');
  }
  const duration = place.booking.slotMinutes || 60;
  const local = localVisitTime(startsAt);
  if (place.business?.closedDates?.includes(local.date)) throw new HttpError(409, 'Place is closed on this date');
  if (local.minute % Math.min(duration, 60) !== 0 ||
    (duration === 120 && Number(local.clock.slice(0, 2)) % 2 !== 0)) {
    throw new HttpError(400, 'Start time must align with slot duration');
  }
  const closeAt = new Date(startsAt.getTime() + duration * 60000);
  const closing = localVisitTime(closeAt);
  const hours = place.business?.openingHours?.find(h => h.day === local.day);
  if (!hours || local.clock < hours.open || closing.day !== local.day || closing.clock > hours.close) {
    throw new HttpError(409, 'Outside opening hours');
  }
  return { capacity, duration };
}

export async function reserveUserWindow(booking) {
  try {
    await BookingUserWindow.updateOne({ user: booking.user }, { $setOnInsert: { reservations: [] } }, { upsert: true });
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
  const now = new Date();
  const updated = await BookingUserWindow.findOneAndUpdate({ user: booking.user,
    reservations: { $not: { $elemMatch: {
      startsAt: { $lt: booking.endsAt }, endsAt: { $gt: booking.startsAt }
    } } },
    $expr: { $lt: [{ $size: { $filter: { input: '$reservations', as: 'item',
      cond: { $gt: ['$$item.startsAt', now] } } } }, 3] }
  }, { $push: { reservations: { booking: booking._id, startsAt: booking.startsAt,
    endsAt: booking.endsAt } } }, { new: true });
  if (!updated) {
    const window = await BookingUserWindow.findOne({ user: booking.user }).lean();
    if (window?.reservations.some(item => item.startsAt < booking.endsAt && item.endsAt > booking.startsAt)) {
      throw new HttpError(409, 'Booking time overlaps another upcoming booking');
    }
    throw new HttpError(409, 'Maximum 3 upcoming bookings');
  }
}

export async function releaseUserWindow(booking) {
  await BookingUserWindow.updateOne({ user: booking.user, 'reservations.booking': booking._id },
    { $pull: { reservations: { booking: booking._id } } });
}

async function migrateLegacyBookingSlot(place, startsAt) {
  const legacy = await BookingSlot.collection.findOne({ place, startsAt, reservations: { $exists: false } });
  if (!legacy) return;
  const bookings = await Booking.find({ place, startsAt,
    status: { $in: ['pending', 'confirmed', 'completed'] } }).select('_id partySize').lean();
  await BookingSlot.collection.updateOne({ _id: legacy._id, reservations: { $exists: false } },
    { $set: { reserved: bookings.reduce((total, item) => total + item.partySize, 0),
      reservations: bookings.map(item => ({ booking: item._id, partySize: item.partySize })) } });
}

export async function migrateLegacyBookingSlots() {
  const legacy = await BookingSlot.collection.find({ reservations: { $exists: false } }).toArray();
  for (const slot of legacy) await migrateLegacyBookingSlot(slot.place, slot.startsAt);
}

export async function reserveSlot(place, booking) {
  const { capacity } = ensureBookable(place, booking.startsAt);
  if (booking.partySize > capacity) throw new HttpError(409, 'Party size exceeds slot capacity');
  await migrateLegacyBookingSlot(place._id, booking.startsAt);
  try {
    await BookingSlot.updateOne({ place: place._id, startsAt: booking.startsAt },
      { $setOnInsert: { capacity, reserved: 0, reservations: [] } }, { upsert: true });
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
  const slot = await BookingSlot.findOneAndUpdate({ place: place._id, startsAt: booking.startsAt,
    reserved: { $lte: capacity - booking.partySize }, 'reservations.booking': { $ne: booking._id } },
  { $inc: { reserved: booking.partySize }, $push: { reservations: { booking: booking._id,
    partySize: booking.partySize } } }, { new: true });
  if (!slot) throw new HttpError(409, 'Slot is full');
  return slot;
}

export async function releaseSlot(booking) {
  await migrateLegacyBookingSlot(booking.place, booking.startsAt);
  await BookingSlot.updateOne({ place: booking.place, startsAt: booking.startsAt,
    'reservations.booking': booking._id }, { $inc: { reserved: -booking.partySize },
    $pull: { reservations: { booking: booking._id } } });
  await releaseUserWindow(booking);
}

export async function reconcileBookingSlots() {
  const now = new Date();
  const slots = await BookingSlot.find({ startsAt: { $gt: now } }).select('_id place startsAt').lean();
  for (const slot of slots) {
    const bookings = await Booking.find({ place: slot.place, startsAt: slot.startsAt,
      status: { $in: ['pending', 'confirmed', 'completed'] } }).select('_id partySize').lean();
    await BookingSlot.updateOne({ _id: slot._id }, { $set: { reserved: bookings.reduce((total, item) => total + item.partySize, 0),
      reservations: bookings.map(item => ({ booking: item._id, partySize: item.partySize })) } });
  }
}

export async function reconcileBookingUserWindows() {
  const now = new Date();
  const bookings = await Booking.find({ status: { $in: ['pending', 'confirmed', 'completed'] }, endsAt: { $gt: now } })
    .select('_id user startsAt endsAt').lean();
  for (const booking of bookings) {
    await BookingUserWindow.updateOne({ user: booking.user }, { $setOnInsert: { reservations: [] } }, { upsert: true });
    await BookingUserWindow.updateOne({ user: booking.user, 'reservations.booking': { $ne: booking._id } },
      { $push: { reservations: { booking: booking._id, startsAt: booking.startsAt, endsAt: booking.endsAt } } });
  }
}

export async function recoverBookingReservations(now = new Date()) {
  const cutoff = new Date(now.getTime() - 2 * 60000);
  const stale = await Booking.find({ status: 'reserving', createdAt: { $lte: cutoff } }).select('_id').lean();
  for (const item of stale) {
    const booking = await Booking.findOneAndUpdate({ _id: item._id, status: 'reserving' },
      { $set: { status: 'cancelled', cancelledAt: now, cancellationKind: 'expired',
        cancellationReason: 'Yêu cầu đặt chỗ chưa hoàn tất' } }, { new: true });
    if (booking) {
      await releaseSlot(booking);
      await Booking.deleteOne({ _id: booking._id, status: 'cancelled',
        cancellationReason: 'Yêu cầu đặt chỗ chưa hoàn tất' });
    }
  }
  const slots = await BookingSlot.find({ startsAt: { $gt: new Date(now.getTime() - 14 * 86400000) },
    'reservations.0': { $exists: true } })
    .select('place startsAt reservations').lean();
  for (const slot of slots) {
    const ids = slot.reservations.map(item => item.booking);
    const bookings = await Booking.find({ _id: { $in: ids } }).select('_id status user place startsAt partySize').lean();
    const byId = new Map(bookings.map(item => [String(item._id), item]));
    for (const reservation of slot.reservations) {
      const booking = byId.get(String(reservation.booking));
      if (booking && !['cancelled', 'no_show'].includes(booking.status)) continue;
      await BookingSlot.updateOne({ _id: slot._id, 'reservations.booking': reservation.booking },
        { $inc: { reserved: -reservation.partySize },
          $pull: { reservations: { booking: reservation.booking } } });
      if (booking) await releaseUserWindow(booking);
    }
  }
  const windows = await BookingUserWindow.find({ 'reservations.0': { $exists: true } }).lean();
  for (const window of windows) {
    const bookings = await Booking.find({ _id: { $in: window.reservations.map(item => item.booking) } })
      .select('_id status endsAt').lean();
    const active = new Set(bookings.filter(item => ['reserving', 'pending', 'confirmed'].includes(item.status) ||
      (item.status === 'completed' && item.endsAt > now))
      .map(item => String(item._id)));
    for (const item of window.reservations) {
      if (!active.has(String(item.booking))) await BookingUserWindow.updateOne({ _id: window._id },
        { $pull: { reservations: { booking: item.booking } } });
    }
  }
  return { expired: stale.length };
}
