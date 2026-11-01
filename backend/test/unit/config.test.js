import { test } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../../src/config.js';

const keys = ['NODE_ENV', 'MONGODB_URI', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'PORT', 'REFRESH_TOKEN_DAYS', 'CLIENT_ORIGINS'];

function withEnv(overrides, run) {
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    for (const key of keys) delete process.env[key];
    Object.assign(process.env, {
      NODE_ENV: 'production', MONGODB_URI: 'mongodb://127.0.0.1:27017/unit',
      JWT_ACCESS_SECRET: 'access-secret-1234567890-abcdefghijk',
      JWT_REFRESH_SECRET: 'refresh-secret-1234567890-abcdefghijk',
      ...overrides
    });
    run();
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

test('production configuration requires separate strong secrets and valid limits', () => {
  withEnv({ PORT: '5000', CLIENT_ORIGINS: 'https://a.example, https://b.example' }, () => {
    const cfg = config();
    assert.equal(cfg.port, 5000);
    assert.deepEqual(cfg.origins, ['https://a.example', 'https://b.example']);
  });
  withEnv({ JWT_REFRESH_SECRET: 'access-secret-1234567890-abcdefghijk' }, () => assert.throws(config, /distinct JWT/));
  withEnv({ JWT_ACCESS_SECRET: 'short' }, () => assert.throws(config, /32\+ characters/));
  withEnv({ PORT: '0' }, () => assert.throws(config, /PORT must be an integer/));
  withEnv({ REFRESH_TOKEN_DAYS: '366' }, () => assert.throws(config, /REFRESH_TOKEN_DAYS must be an integer/));
});
