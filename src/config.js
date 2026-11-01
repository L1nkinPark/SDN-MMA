import 'dotenv/config';

function positiveInteger(name, fallback, max = Number.MAX_SAFE_INTEGER) {
  const value = Number(process.env[name] || fallback);
  if (!Number.isInteger(value) || value < 1 || value > max) throw new Error(`${name} must be an integer from 1 to ${max}`);
  return value;
}

export function config() {
  const production = process.env.NODE_ENV === 'production';
  const accessSecret = process.env.JWT_ACCESS_SECRET || (production ? '' : 'dev-access-secret-change-before-production-123');
  const refreshSecret = process.env.JWT_REFRESH_SECRET || (production ? '' : 'dev-refresh-secret-change-before-production-456');
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
  if (accessSecret.length < 32 || refreshSecret.length < 32 || accessSecret === refreshSecret) {
    throw new Error('Set distinct JWT_ACCESS_SECRET and JWT_REFRESH_SECRET (32+ characters)');
  }
  return {
    production,
    port: positiveInteger('PORT', 4000, 65535),
    mongoUri: process.env.MONGODB_URI,
    accessSecret,
    refreshSecret,
    accessTtl: process.env.ACCESS_TOKEN_TTL || '15m',
    refreshDays: positiveInteger('REFRESH_TOKEN_DAYS', 30, 365),
    origins: (process.env.CLIENT_ORIGINS || 'http://localhost:3000,http://localhost:8081').split(',').map(s => s.trim()).filter(Boolean),
    checkinMinutes: positiveInteger('CHECKIN_DURATION_MINUTES', 120, 1440),
    minSamples: positiveInteger('STATUS_MIN_SAMPLES', 2, 100),
    refreshMs: positiveInteger('STATUS_REFRESH_MS', 60000)
  };
}
