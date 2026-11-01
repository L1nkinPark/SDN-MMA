import mongoose from 'mongoose';
import { config } from './config.js';
import { refreshExpiredStatuses } from './services/statusService.js';
import { createHttpServer } from './http.js';

const cfg = config();
await mongoose.connect(cfg.mongoUri);
const { server, io } = createHttpServer(cfg);

const timer = setInterval(() => refreshExpiredStatuses(cfg, io).catch(console.error), cfg.refreshMs);
timer.unref();
server.listen(cfg.port, () => console.log(`StudySpot API listening on http://localhost:${cfg.port}`));

async function shutdown() {
  clearInterval(timer);
  io.close();
  server.close();
  await mongoose.disconnect();
}
process.once('SIGINT', () => shutdown().then(() => process.exit(0)));
process.once('SIGTERM', () => shutdown().then(() => process.exit(0)));
