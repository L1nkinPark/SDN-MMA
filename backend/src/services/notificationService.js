import nodemailer from 'nodemailer';
import { EmailOutbox, Notification, User } from '../models/index.js';
import { HttpError } from '../utils/common.js';

export async function sendEmail(cfg, { to, subject, text }) {
  if (!cfg.smtp) throw new HttpError(503, 'Email delivery is not configured');
  const smtp = cfg.smtp;
  const transport = nodemailer.createTransport({
    host: smtp.host, port: smtp.port, secure: smtp.secure, requireTLS: smtp.requireTLS,
    connectionTimeout: 5000, socketTimeout: 5000,
    ...(smtp.user ? { auth: { user: smtp.user, pass: smtp.pass } } : {})
  });
  await transport.sendMail({ from: smtp.from, to, subject, text });
}

export async function queueEmail(cfg, { to, subject, text, expiresAt }) {
  if (!cfg.smtp) throw new HttpError(503, 'Email delivery is not configured');
  return EmailOutbox.create({ to, subject, text,
    ...(expiresAt ? { expiresAt } : {}) });
}

export async function processEmailOutbox(cfg, now = new Date(), deliver = sendEmail) {
  if (!cfg.smtp) return { sent: 0, retried: 0, failed: 0 };
  const result = { sent: 0, retried: 0, failed: 0 };
  for (let index = 0; index < 100; index += 1) {
    const mail = await EmailOutbox.findOneAndUpdate({
      $or: [{ status: 'pending', nextAttemptAt: { $lte: now } },
        { status: 'sending', lockedUntil: { $lte: now } }], expiresAt: { $gt: now }
    }, { $set: { status: 'sending', lockedUntil: new Date(now.getTime() + 30000) }, $inc: { attempts: 1 } },
    { new: true, sort: { nextAttemptAt: 1 } });
    if (!mail) break;
    try {
      await deliver(cfg, { to: mail.to, subject: mail.subject, text: mail.text });
      await EmailOutbox.updateOne({ _id: mail._id, status: 'sending' },
        { $set: { status: 'sent', text: '', sentAt: now, lockedUntil: null, lastError: null } });
      result.sent += 1;
    } catch {
      const delay = Math.min(16, 2 ** (mail.attempts - 1)) * 60000;
      const nextAttemptAt = new Date(now.getTime() + delay);
      const failed = mail.attempts >= 5 || nextAttemptAt >= mail.expiresAt;
      await EmailOutbox.updateOne({ _id: mail._id, status: 'sending' }, { $set: {
        status: failed ? 'failed' : 'pending', text: failed ? '' : mail.text,
        nextAttemptAt, lockedUntil: null, lastError: 'Delivery failed'
      } });
      if (failed) await notifyAdmins({ ...cfg, smtp: null }, { kind: 'email_delivery_failed',
        title: 'Email gửi thất bại', body: `Email số ${mail._id} đã hết số lần gửi lại. Kiểm tra SMTP và hàng đợi.`,
        resourceType: 'EmailOutbox', resourceId: mail._id }).catch(console.error);
      result[failed ? 'failed' : 'retried'] += 1;
    }
  }
  return result;
}

export async function notifyUser(cfg, userId, { kind, title, body, resourceType = null, resourceId = null }) {
  const user = await User.findById(userId).select('email notificationSettings status');
  if (!user || (user.status && user.status !== 'active')) return;
  if (user.notificationSettings?.inApp !== false) {
    await Notification.create({ user: user._id, kind, title, body, resourceType, resourceId });
  }
  if (cfg.smtp && user.notificationSettings?.email !== false) {
    await queueEmail(cfg, { to: user.email, subject: `[StudySpot] ${title}`, text: body });
  }
}

export async function notifyAdmins(cfg, event) {
  const admins = await User.find({ role: 'admin', status: 'active' }).select('_id').lean();
  await Promise.all(admins.map(admin => notifyUser(cfg, admin._id, event)));
}
