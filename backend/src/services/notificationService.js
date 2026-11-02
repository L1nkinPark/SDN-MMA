import nodemailer from 'nodemailer';
import { Notification, User } from '../models/index.js';
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

export async function notifyUser(cfg, userId, { kind, title, body, resourceType = null, resourceId = null }) {
  const user = await User.findById(userId).select('email notificationSettings status');
  if (!user || (user.status && user.status !== 'active')) return;
  if (user.notificationSettings?.inApp !== false) {
    await Notification.create({ user: user._id, kind, title, body, resourceType, resourceId });
  }
  if (cfg.smtp && user.notificationSettings?.email !== false) {
    try { await sendEmail(cfg, { to: user.email, subject: `[StudySpot] ${title}`, text: body }); }
    catch (error) { console.error('Notification email failed:', error); }
  }
}

export async function notifyAdmins(cfg, event) {
  const admins = await User.find({ role: 'admin', status: 'active' }).select('_id').lean();
  await Promise.all(admins.map(admin => notifyUser(cfg, admin._id, event)));
}
