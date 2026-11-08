import { Booking, BookingSlot } from '../models/index.js';
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

export async function reserveSlot(place, startsAt, partySize) {
  const { capacity } = ensureBookable(place, startsAt);
  if (partySize > capacity) throw new HttpError(409, 'Party size exceeds slot capacity');
  try {
    await BookingSlot.updateOne({ place: place._id, startsAt },
      { $setOnInsert: { capacity, reserved: 0 } }, { upsert: true });
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
  const slot = await BookingSlot.findOneAndUpdate({ place: place._id, startsAt,
    reserved: { $lte: capacity - partySize } }, { $inc: { reserved: partySize } }, { new: true });
  if (!slot) throw new HttpError(409, 'Slot is full');
  return slot;
}

export async function releaseSlot(booking) {
  await BookingSlot.updateOne({ place: booking.place, startsAt: booking.startsAt,
    reserved: { $gte: booking.partySize } }, { $inc: { reserved: -booking.partySize } });
}

export async function reconcileBookingSlots() {
  const now = new Date();
  const slots = await BookingSlot.find({ startsAt: { $gt: now } }).select('_id place startsAt').lean();
  for (const slot of slots) {
    const totals = await Booking.aggregate([
      { $match: { place: slot.place, startsAt: slot.startsAt, status: { $in: ['pending', 'confirmed', 'completed'] } } },
      { $group: { _id: null, reserved: { $sum: '$partySize' } } }
    ]);
    await BookingSlot.updateOne({ _id: slot._id }, { $set: { reserved: totals[0]?.reserved || 0 } });
  }
}
