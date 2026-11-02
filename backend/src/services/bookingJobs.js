import { Booking, Place } from '../models/index.js';
import { notifyUser } from './notificationService.js';
import { releaseSlot } from './bookingService.js';

export async function processBookingDeadlines(cfg, now = new Date()) {
  const cutoff = new Date(now.getTime() - 15 * 60000);
  const pendingCutoff = new Date(now.getTime() + 60 * 60000);
  const pending = await Booking.find({ status: 'pending', startsAt: { $lte: pendingCutoff } }).limit(100).lean();
  let expiredPending = 0;
  for (const candidate of pending) {
    const booking = await Booking.findOneAndUpdate({ _id: candidate._id, status: 'pending' },
      { $set: { status: 'cancelled' } }, { new: true });
    if (!booking) continue;
    expiredPending += 1;
    await releaseSlot(booking);
    await notifyUser(cfg, booking.user, { kind: 'booking_unconfirmed', title: 'Booking chưa được quán xác nhận',
      body: 'Yêu cầu đã tự hủy trước giờ đến. Bạn có thể chọn địa điểm khác.',
      resourceType: 'Booking', resourceId: booking._id }).catch(console.error);
  }
  const overdue = await Booking.find({ status: 'confirmed', startsAt: { $lte: cutoff } }).limit(100).lean();
  let noShows = 0;
  for (const candidate of overdue) {
    const booking = await Booking.findOneAndUpdate({ _id: candidate._id, status: 'confirmed' },
      { $set: { status: 'no_show' } }, { new: true });
    if (!booking) continue;
    noShows += 1;
    await notifyUser(cfg, booking.user, { kind: 'booking_no_show', title: 'Booking quá giờ đến',
      body: 'Booking được ghi nhận không đến. Nếu có nhầm lẫn, hãy liên hệ cửa hàng hoặc quản trị viên.',
      resourceType: 'Booking', resourceId: booking._id }).catch(console.error);
  }
  const reminderEnd = new Date(now.getTime() + 60 * 60000);
  const reminders = await Booking.find({ status: 'confirmed', startsAt: { $gt: now, $lte: reminderEnd }, remindedAt: null })
    .limit(100).lean();
  let reminded = 0;
  for (const candidate of reminders) {
    const booking = await Booking.findOneAndUpdate({ _id: candidate._id, status: 'confirmed', remindedAt: null },
      { $set: { remindedAt: now } }, { new: true });
    if (!booking) continue;
    reminded += 1;
    const place = await Place.findById(booking.place).select('name');
    await notifyUser(cfg, booking.user, { kind: 'booking_reminder', title: 'Sắp đến giờ đặt chỗ',
      body: `Booking tại ${place?.name || 'cửa hàng'} bắt đầu lúc ${booking.startsAt.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}.`,
      resourceType: 'Booking', resourceId: booking._id }).catch(console.error);
  }
  return { expiredPending, noShows, reminded };
}
