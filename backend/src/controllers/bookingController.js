import { z } from 'zod';
import { AuditEvent, Booking, BookingSlot, Place, VisitProof } from '../models/index.js';
import { ensureBookable, releaseSlot, reserveSlot, reserveUserWindow } from '../services/bookingService.js';
import { HttpError, assertId, pageQuery, parse } from '../utils/common.js';
import { notifyUser } from '../services/notificationService.js';
import { linkReviewToVisit } from '../services/visitReviewService.js';

const createBody = z.object({
  placeId: z.string(), startsAt: z.iso.datetime({ offset: true }),
  partySize: z.number().int().min(1).max(20), note: z.string().trim().max(500).default(''),
  idempotencyKey: z.string().trim().min(8).max(128).regex(/^[a-zA-Z0-9._:-]+$/).optional()
});

function sameRequest(booking, placeId, startsAt, body) {
  return String(booking.place) === String(placeId) && booking.startsAt.getTime() === startsAt.getTime() &&
    booking.partySize === body.partySize && (booking.note || '') === body.note;
}

function existingResponse(res, booking, placeId, startsAt, body) {
  if (!sameRequest(booking, placeId, startsAt, body)) throw new HttpError(409, 'Booking request differs from existing booking');
  if (booking.status === 'reserving') throw new HttpError(409, 'Booking request is still processing');
  return res.json({ booking, alreadyExists: true });
}

export const bookingController = {
  availability: async (req, res) => {
    const placeId = assertId(req.params.id);
    const { date } = parse(z.object({ date: z.iso.date() }), req.query);
    const place = await Place.findById(placeId);
    if (!place || place.approval !== 'approved') throw new HttpError(404, 'Place not found');
    const start = new Date(`${date}T00:00:00+07:00`);
    const end = new Date(start.getTime() + 86400000);
    const slots = await BookingSlot.find({ place: placeId, startsAt: { $gte: start, $lt: end } })
      .select('startsAt capacity reserved').sort({ startsAt: 1 }).lean();
    const closedOnDate = place.business?.closedDates?.includes(date) || false;
    res.json({ placeId, date, closedOnDate, enabled: Boolean(place.booking?.enabled && !place.business?.temporaryClosed && !closedOnDate),
      capacityPerSlot: place.booking?.capacityPerSlot || null, slotMinutes: place.booking?.slotMinutes || 60,
      openingHours: place.business?.openingHours || [], closedDates: place.business?.closedDates || [], slots });
  },
  create: async (req, res) => {
    const body = parse(createBody, req.body);
    const placeId = assertId(body.placeId);
    const startsAt = new Date(body.startsAt);
    if (body.idempotencyKey) {
      const previous = await Booking.findOne({ user: req.user._id, idempotencyKey: body.idempotencyKey });
      if (previous) return existingResponse(res, previous, placeId, startsAt, body);
    }
    const now = Date.now();
    if (startsAt.getTime() < now + 3600000 || startsAt.getTime() > now + 14 * 86400000) {
      throw new HttpError(400, 'Booking must be 1 hour to 14 days ahead');
    }
    const place = await Place.findById(placeId);
    if (place && String(place.owner) === String(req.user._id)) throw new HttpError(403, 'Owner cannot book own place');
    const { duration } = ensureBookable(place, startsAt);
    const existing = await Booking.findOne({ user: req.user._id, place: placeId, startsAt,
      status: { $in: ['pending', 'confirmed'] } });
    if (existing) return existingResponse(res, existing, placeId, startsAt, body);
    let booking;
    try {
      const pending = place.booking.approvalMode === 'manual';
      booking = await Booking.create({ user: req.user._id, place: placeId, startsAt,
        endsAt: new Date(startsAt.getTime() + duration * 60000), partySize: body.partySize, note: body.note,
        idempotencyKey: body.idempotencyKey || null, status: 'reserving',
        holdUntil: pending ? new Date(Math.min(now + 10 * 60000, startsAt.getTime() - 3600000)) : null });
      await reserveUserWindow(booking);
      await reserveSlot(place, booking);
      const final = await Booking.findOneAndUpdate({ _id: booking._id, status: 'reserving' },
        { $set: { status: pending ? 'pending' : 'confirmed' } }, { new: true });
      if (!final) throw new HttpError(409, 'Booking request expired before completion');
      booking = final;
    } catch (error) {
      if (booking) {
        const aborted = await Booking.findOneAndUpdate({ _id: booking._id, status: 'reserving' },
          { $set: { status: 'cancelled', cancelledAt: new Date(), cancellationKind: 'expired',
            cancellationReason: 'Yêu cầu đặt chỗ không hoàn tất' } }, { new: true });
        await releaseSlot(aborted || booking);
        await Booking.deleteOne({ _id: booking._id, status: 'cancelled' });
      }
      if (error.code === 11000) {
        const previous = await Booking.findOne({ user: req.user._id, $or: [
          ...(body.idempotencyKey ? [{ idempotencyKey: body.idempotencyKey }] : []),
          { place: placeId, startsAt, status: { $in: ['pending', 'confirmed'] } }
        ] });
        if (previous) return existingResponse(res, previous, placeId, startsAt, body);
      }
      throw error;
    }
    const event = { kind: `booking_${booking.status}`, title: booking.status === 'pending' ? 'Đang chờ quán xác nhận' : 'Đặt chỗ thành công',
      body: `Bạn đã đặt ${body.partySize} chỗ tại ${place.name} vào ${startsAt.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}. Trạng thái: ${booking.status}.`,
      resourceType: 'Booking', resourceId: booking._id };
    await notifyUser(req.app.locals.cfg, req.user._id, event).catch(console.error);
    if (place.owner) await notifyUser(req.app.locals.cfg, place.owner, { ...event,
      title: 'Có booking mới', body: `${req.user.name} đặt ${body.partySize} chỗ tại ${place.name}.` }).catch(console.error);
    res.status(201).json({ booking });
  },
  mine: async (req, res) => {
    const { page, limit } = parse(pageQuery, req.query);
    const query = { user: req.user._id, status: { $ne: 'reserving' } };
    const [items, total] = await Promise.all([
      Booking.find(query).populate('place', 'name address images').sort({ startsAt: -1 })
        .skip((page - 1) * limit).limit(limit).lean(), Booking.countDocuments(query)
    ]);
    res.json({ items, page, limit, total });
  },
  cancelMine: async (req, res) => {
    const id = assertId(req.params.id);
    const cancelledAt = new Date();
    const booking = await Booking.findOneAndUpdate({ _id: id, user: req.user._id, status: { $in: ['pending', 'confirmed'] },
      startsAt: { $gt: new Date(Date.now() + 3600000) } },
    { $set: { status: 'cancelled', cancelledBy: req.user._id, cancelledAt,
      cancellationKind: 'user', cancellationReason: 'Khách chủ động hủy' } }, { new: true });
    if (!booking) {
      const previous = await Booking.findOne({ _id: id, user: req.user._id, status: 'cancelled', cancellationKind: 'user' });
      if (previous) return res.json({ booking: previous, alreadyExists: true });
      throw new HttpError(409, 'Booking cannot be cancelled');
    }
    await releaseSlot(booking);
    const place = await Place.findById(booking.place).select('owner name');
    if (place?.owner) await notifyUser(req.app.locals.cfg, place.owner, { kind: 'booking_cancelled',
      title: 'Khách đã hủy booking', body: `${req.user.name} đã hủy booking tại ${place.name}.`,
      resourceType: 'Booking', resourceId: booking._id }).catch(console.error);
    res.json({ booking });
  },
  placeBookings: async (req, res) => {
    const placeId = assertId(req.params.id);
    if (!(await Place.exists({ _id: placeId, owner: req.user._id }))) throw new HttpError(404, 'Owned place not found');
    const { page, limit, status } = parse(pageQuery.extend({
      status: z.enum(['pending', 'confirmed', 'cancelled', 'completed', 'no_show']).optional()
    }), req.query);
    const query = { place: placeId, status: status || { $ne: 'reserving' } };
    const [items, total] = await Promise.all([
      Booking.find(query).populate('user', 'name email').sort({ startsAt: -1 })
        .skip((page - 1) * limit).limit(limit).lean(), Booking.countDocuments(query)
    ]);
    res.json({ items, page, limit, total });
  },
  merchantDecision: async (req, res) => {
    const id = assertId(req.params.id);
    const { action, reason } = parse(z.object({ action: z.enum(['approve', 'reject', 'arrived', 'cancel', 'no_show']),
      reason: z.string().trim().min(5).max(500).optional() }), req.body);
    if (['reject', 'cancel', 'no_show'].includes(action) && !reason) throw new HttpError(400, 'Reason is required');
    const existing = await Booking.findById(id);
    if (!existing) throw new HttpError(404, 'Booking not found');
    if (!(await Place.exists({ _id: existing.place, owner: req.user._id }))) throw new HttpError(403, 'Place ownership required');
    const now = Date.now();
    if (['approve', 'reject'].includes(action)) {
      if (now >= existing.startsAt.getTime()) throw new HttpError(409, 'Booking already started');
      const status = action === 'approve' ? 'confirmed' : 'cancelled';
      const booking = await Booking.findOneAndUpdate({ _id: id, status: 'pending',
        $or: [{ holdUntil: { $gt: new Date(now) } }, { holdUntil: null, startsAt: { $gt: new Date(now + 3600000) } }] },
        { $set: { status, decidedBy: req.user._id, decidedAt: new Date(now),
          ...(action === 'reject' ? { cancelledBy: req.user._id, cancelledAt: new Date(now),
            cancellationKind: 'declined', cancellationReason: reason } : {}) } }, { new: true });
      if (!booking) throw new HttpError(409, 'Pending booking not found');
      if (action === 'reject') await releaseSlot(booking);
      await AuditEvent.create({ actor: req.user._id, action: `booking.${action}`, targetType: 'Booking',
        targetId: booking._id, detail: reason || '' });
      await notifyUser(req.app.locals.cfg, booking.user, { kind: `booking_${status}`,
        title: action === 'approve' ? 'Quán đã xác nhận booking' : 'Quán từ chối booking',
        body: reason || 'Xem chi tiết booking trong ứng dụng StudySpot.', resourceType: 'Booking', resourceId: booking._id }).catch(console.error);
      return res.json({ booking });
    }
    if (action === 'arrived' && (now < existing.startsAt.getTime() - 15 * 60000 ||
      now > existing.startsAt.getTime() + 15 * 60000)) throw new HttpError(409, 'Outside arrival window');
    if (action === 'no_show' && now < existing.startsAt.getTime() + 15 * 60000) {
      throw new HttpError(409, 'Too early to mark no-show');
    }
    if (action === 'cancel' && now >= existing.startsAt.getTime()) throw new HttpError(409, 'Booking already started');
    const status = { arrived: 'completed', cancel: 'cancelled', no_show: 'no_show' }[action];
    const booking = await Booking.findOneAndUpdate({ _id: id, status: 'confirmed' },
      { $set: { status, decidedBy: req.user._id, decidedAt: new Date(now),
        ...(action === 'arrived' ? { arrivedAt: new Date(now) } : {}),
        ...(action === 'no_show' ? { noShowAt: new Date(now) } : {}),
        ...(action === 'cancel' ? { cancelledBy: req.user._id,
          cancelledAt: new Date(now), cancellationKind: 'merchant', cancellationReason: reason } : {}) } }, { new: true });
    if (!booking) throw new HttpError(409, 'Booking already processed');
    if (action === 'cancel' || action === 'no_show') await releaseSlot(booking);
    if (action === 'arrived') {
      const proof = await VisitProof.create({ user: booking.user, place: booking.place,
        method: 'staff_booking', booking: booking._id, verifiedAt: booking.arrivedAt });
      await linkReviewToVisit(proof);
    }
    await AuditEvent.create({ actor: req.user._id, action: `booking.${action}`, targetType: 'Booking',
      targetId: booking._id, detail: reason || '' });
    await notifyUser(req.app.locals.cfg, booking.user, { kind: `booking_${status}`, title: {
      completed: 'Đã xác nhận bạn đến quán', cancelled: 'Quán đã hủy booking', no_show: 'Booking được ghi nhận không đến'
    }[status], body: reason || 'Xem chi tiết booking trong ứng dụng StudySpot.',
    resourceType: 'Booking', resourceId: booking._id }).catch(console.error);
    res.json({ booking });
  }
};
