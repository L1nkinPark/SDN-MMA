import { z } from 'zod';
import { Booking, BookingSlot, Place, VisitProof } from '../models/index.js';
import { ensureBookable, releaseSlot, reserveSlot } from '../services/bookingService.js';
import { HttpError, assertId, pageQuery, parse } from '../utils/common.js';

const createBody = z.object({
  placeId: z.string(), startsAt: z.iso.datetime({ offset: true }),
  partySize: z.number().int().min(1).max(20), note: z.string().trim().max(500).default('')
});

export const bookingController = {
  availability: async (req, res) => {
    const placeId = assertId(req.params.id);
    const { date } = parse(z.object({ date: z.iso.date() }), req.query);
    const place = await Place.findById(placeId);
    if (!place || place.approval !== 'approved') throw new HttpError(404, 'Place not found');
    const start = new Date(`${date}T00:00:00+07:00`);
    const end = new Date(start.getTime() + 86400000);
    const slots = await BookingSlot.find({ place: placeId, startsAt: { $gte: start, $lt: end } })
      .sort({ startsAt: 1 }).lean();
    res.json({ placeId, date, enabled: Boolean(place.booking?.enabled && !place.business?.temporaryClosed),
      capacityPerSlot: place.booking?.capacityPerSlot || null, slotMinutes: place.booking?.slotMinutes || 60,
      openingHours: place.business?.openingHours || [], slots });
  },
  create: async (req, res) => {
    const body = parse(createBody, req.body);
    const placeId = assertId(body.placeId);
    const startsAt = new Date(body.startsAt);
    const now = Date.now();
    if (startsAt.getTime() < now + 3600000 || startsAt.getTime() > now + 14 * 86400000) {
      throw new HttpError(400, 'Booking must be 1 hour to 14 days ahead');
    }
    const place = await Place.findById(placeId);
    if (place && String(place.owner) === String(req.user._id)) throw new HttpError(403, 'Owner cannot book own place');
    const { duration } = ensureBookable(place, startsAt);
    const existing = await Booking.findOne({ user: req.user._id, place: placeId, startsAt, status: 'confirmed' });
    if (existing) return res.json({ booking: existing, alreadyExists: true });
    if (await Booking.countDocuments({ user: req.user._id, status: 'confirmed', startsAt: { $gt: new Date() } }) >= 3) {
      throw new HttpError(409, 'Maximum 3 upcoming bookings');
    }
    await reserveSlot(place, startsAt, body.partySize);
    let booking;
    try {
      booking = await Booking.create({ user: req.user._id, place: placeId, startsAt,
        endsAt: new Date(startsAt.getTime() + duration * 60000), partySize: body.partySize, note: body.note });
    } catch (error) {
      await BookingSlot.updateOne({ place: placeId, startsAt, reserved: { $gte: body.partySize } },
        { $inc: { reserved: -body.partySize } });
      if (error.code === 11000) {
        const previous = await Booking.findOne({ user: req.user._id, place: placeId, startsAt, status: 'confirmed' });
        if (previous) return res.json({ booking: previous, alreadyExists: true });
      }
      throw error;
    }
    res.status(201).json({ booking });
  },
  mine: async (req, res) => {
    const { page, limit } = parse(pageQuery, req.query);
    const query = { user: req.user._id };
    const [items, total] = await Promise.all([
      Booking.find(query).populate('place', 'name address images').sort({ startsAt: -1 })
        .skip((page - 1) * limit).limit(limit).lean(), Booking.countDocuments(query)
    ]);
    res.json({ items, page, limit, total });
  },
  cancelMine: async (req, res) => {
    const id = assertId(req.params.id);
    const booking = await Booking.findOneAndUpdate({ _id: id, user: req.user._id, status: 'confirmed',
      startsAt: { $gt: new Date(Date.now() + 3600000) } },
    { $set: { status: 'cancelled', cancelledBy: req.user._id } }, { new: true });
    if (!booking) throw new HttpError(409, 'Booking cannot be cancelled');
    await releaseSlot(booking);
    res.json({ booking });
  },
  placeBookings: async (req, res) => {
    const placeId = assertId(req.params.id);
    if (!(await Place.exists({ _id: placeId, owner: req.user._id }))) throw new HttpError(404, 'Owned place not found');
    const { page, limit, status } = parse(pageQuery.extend({
      status: z.enum(['confirmed', 'cancelled', 'completed', 'no_show']).optional()
    }), req.query);
    const query = { place: placeId, ...(status ? { status } : {}) };
    const [items, total] = await Promise.all([
      Booking.find(query).populate('user', 'name email').sort({ startsAt: -1 })
        .skip((page - 1) * limit).limit(limit).lean(), Booking.countDocuments(query)
    ]);
    res.json({ items, page, limit, total });
  },
  merchantDecision: async (req, res) => {
    const id = assertId(req.params.id);
    const { action } = parse(z.object({ action: z.enum(['arrived', 'cancel', 'no_show']) }), req.body);
    const existing = await Booking.findById(id);
    if (!existing) throw new HttpError(404, 'Booking not found');
    if (!(await Place.exists({ _id: existing.place, owner: req.user._id }))) throw new HttpError(403, 'Place ownership required');
    const now = Date.now();
    if (action === 'arrived' && (now < existing.startsAt.getTime() - 15 * 60000 ||
      now > existing.endsAt.getTime() + 15 * 60000)) throw new HttpError(409, 'Outside arrival window');
    if (action === 'no_show' && now < existing.startsAt.getTime() + 15 * 60000) {
      throw new HttpError(409, 'Too early to mark no-show');
    }
    if (action === 'cancel' && now >= existing.startsAt.getTime()) throw new HttpError(409, 'Booking already started');
    const status = { arrived: 'completed', cancel: 'cancelled', no_show: 'no_show' }[action];
    const booking = await Booking.findOneAndUpdate({ _id: id, status: 'confirmed' },
      { $set: { status, ...(action === 'arrived' ? { arrivedAt: new Date() } : {}),
        ...(action === 'cancel' ? { cancelledBy: req.user._id } : {}) } }, { new: true });
    if (!booking) throw new HttpError(409, 'Booking already processed');
    if (action === 'cancel') await releaseSlot(booking);
    if (action === 'arrived') await VisitProof.create({ user: booking.user, place: booking.place,
      method: 'staff_booking', booking: booking._id, verifiedAt: booking.arrivedAt });
    res.json({ booking });
  }
};
