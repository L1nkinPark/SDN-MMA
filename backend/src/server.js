import mongoose from 'mongoose';
import { config } from './config.js';
import { refreshExpiredStatuses } from './services/statusService.js';
import { createHttpServer } from './http.js';
import { Booking, BookingSlot, FraudFlag, MerchantClaim, Notification, PasswordReset, PlaceChangeRequest, VisitProof } from './models/index.js';
import { reconcileBookingSlots } from './services/bookingService.js';
import { processBookingDeadlines } from './services/bookingJobs.js';

const cfg = config();
await mongoose.connect(cfg.mongoUri);
await Promise.all([Booking.init(), BookingSlot.init(), FraudFlag.init(), MerchantClaim.init(),
  Notification.init(), PasswordReset.init(), PlaceChangeRequest.init(), VisitProof.init()]);
await reconcileBookingSlots();
const { server, io } = createHttpServer(cfg);

const timer = setInterval(() => refreshExpiredStatuses(cfg, io).catch(console.error), cfg.refreshMs);
timer.unref();
const bookingTimer = setInterval(() => processBookingDeadlines(cfg).catch(console.error), 60000);
bookingTimer.unref();
await processBookingDeadlines(cfg);
server.listen(cfg.port, () => console.log(`StudySpot API listening on http://localhost:${cfg.port}`));

async function shutdown() {
  clearInterval(timer);
  clearInterval(bookingTimer);
  io.close();
  server.close();
  await mongoose.disconnect();
}
process.once('SIGINT', () => shutdown().then(() => process.exit(0)));
process.once('SIGTERM', () => shutdown().then(() => process.exit(0)));
