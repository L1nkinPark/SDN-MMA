import mongoose from 'mongoose';
import { config } from './config.js';
import { refreshExpiredStatuses } from './services/statusService.js';
import { createHttpServer } from './http.js';
import { Booking, BookingSlot, EmailOutbox, FraudFlag, MerchantClaim, Notification, PasswordReset, PlaceChangeRequest, VisitProof } from './models/index.js';
import { reconcileBookingSlots } from './services/bookingService.js';
import { processBookingDeadlines } from './services/bookingJobs.js';
import { processEmailOutbox } from './services/notificationService.js';

const cfg = config();
await mongoose.connect(cfg.mongoUri);
await Promise.all([Booking.init(), BookingSlot.init(), EmailOutbox.init(), FraudFlag.init(), MerchantClaim.init(),
  Notification.init(), PasswordReset.init(), PlaceChangeRequest.init(), VisitProof.init()]);
await reconcileBookingSlots();
const { server, io } = createHttpServer(cfg);

const timer = setInterval(() => refreshExpiredStatuses(cfg, io).catch(console.error), cfg.refreshMs);
timer.unref();
const bookingTimer = setInterval(() => processBookingDeadlines(cfg).catch(console.error), 60000);
bookingTimer.unref();
await processBookingDeadlines(cfg);
const emailTimer = setInterval(() => processEmailOutbox(cfg).catch(console.error), 30000);
emailTimer.unref();
processEmailOutbox(cfg).catch(console.error);
server.listen(cfg.port, () => console.log(`StudySpot API listening on http://localhost:${cfg.port}`));

async function shutdown() {
  clearInterval(timer);
  clearInterval(bookingTimer);
  clearInterval(emailTimer);
  io.close();
  server.close();
  await mongoose.disconnect();
}
process.once('SIGINT', () => shutdown().then(() => process.exit(0)));
process.once('SIGTERM', () => shutdown().then(() => process.exit(0)));
