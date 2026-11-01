import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { v2 as cloudinary } from 'cloudinary';
import { HttpError, assertId, coordinates, distanceMeters, escapeRegex, parse } from '../../src/utils/common.js';
import { accessToken, refreshToken, tokenHash } from '../../src/services/tokenService.js';
import { assertSupportedImage, uploadPlaceImage } from '../../src/services/imageService.js';

test('distance uses longitude/latitude and handles the antimeridian', () => {
  assert.equal(distanceMeters([106.8, 10.8], [106.8, 10.8]), 0);
  const oneDegree = distanceMeters([106.8, 10], [106.8, 11]);
  assert.ok(oneDegree > 111000 && oneDegree < 111400);
  const acrossDateline = distanceMeters([179.9, 0], [-179.9, 0]);
  assert.ok(acrossDateline > 22000 && acrossDateline < 22500);
  assert.equal(distanceMeters([1, 2], [3, 4]), distanceMeters([3, 4], [1, 2]));
});

test('search input is treated as literal text and validation reports bad coordinates', () => {
  const literal = 'Cafe [A]+ (2026).';
  const regex = new RegExp(escapeRegex(literal));
  assert.equal(regex.test(literal), true);
  assert.equal(regex.test('Cafe Aaaa (2026)x'), false);
  assert.deepEqual(parse(coordinates, [106.8, 10.8]), [106.8, 10.8]);
  assert.throws(() => parse(coordinates, [106.8, 100.8]), err => err instanceof HttpError && err.status === 400);
  assert.throws(() => assertId('not-an-id'), err => err instanceof HttpError && err.status === 400);
  assert.equal(parse(z.object({ count: z.number() }), { count: 2 }).count, 2);
});

test('access and refresh tokens have distinct purpose and refresh jti rotates', () => {
  const cfg = { accessSecret: 'unit-access-secret-1234567890-abcdef', refreshSecret: 'unit-refresh-secret-1234567890-abcdef', accessTtl: '15m', refreshDays: 30 };
  const user = { _id: '507f1f77bcf86cd799439011', role: 'student' };
  const access = accessToken(user, cfg);
  const refreshA = refreshToken(user, cfg);
  const refreshB = refreshToken(user, cfg);
  assert.equal(jwt.verify(access, cfg.accessSecret).type, 'access');
  assert.equal(jwt.verify(refreshA, cfg.refreshSecret).type, 'refresh');
  assert.notEqual(refreshA, refreshB);
  assert.notEqual(tokenHash(refreshA), refreshA);
  assert.equal(tokenHash(refreshA), tokenHash(refreshA));
  assert.throws(() => jwt.verify(access, cfg.refreshSecret));
});

test('image validation rejects forged MIME and accepts PNG, JPEG, WebP signatures', () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9R3x0AAAAASUVORK5CYII=', 'base64');
  assert.doesNotThrow(() => assertSupportedImage({ mimetype: 'image/png', buffer: png }));
  assert.doesNotThrow(() => assertSupportedImage({ mimetype: 'image/jpeg', buffer: Buffer.from([255, 216, 255, 0]) }));
  assert.doesNotThrow(() => assertSupportedImage({ mimetype: 'image/webp', buffer: Buffer.from('RIFF1234WEBP', 'ascii') }));
  for (const file of [
    { mimetype: 'image/png', buffer: Buffer.from('<script>alert(1)</script>') },
    { mimetype: 'image/jpeg', buffer: png },
    { mimetype: 'image/webp', buffer: Buffer.from('RIFF1234NOTP', 'ascii') },
    { mimetype: 'image/png', buffer: Buffer.from([137, 80]) }
  ]) {
    assert.throws(() => assertSupportedImage(file), err => err instanceof HttpError && err.status === 400);
  }
});

test('image upload requires configuration and sends verified image bytes to Cloudinary', async t => {
  const keys = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const file = {
    mimetype: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9R3x0AAAAASUVORK5CYII=', 'base64')
  };
  try {
    for (const key of keys) delete process.env[key];
    await assert.rejects(uploadPlaceImage(file), err => err instanceof HttpError && err.status === 503);
    Object.assign(process.env, {
      CLOUDINARY_CLOUD_NAME: 'unit-cloud', CLOUDINARY_API_KEY: 'unit-key', CLOUDINARY_API_SECRET: 'unit-secret'
    });
    const upload = t.mock.method(cloudinary.uploader, 'upload', async (data, options) => {
      assert.equal(data, `data:image/png;base64,${file.buffer.toString('base64')}`);
      assert.deepEqual(options, { folder: 'studyspot/places', resource_type: 'image' });
      return { secure_url: 'https://example.test/photo.png' };
    });
    assert.equal(await uploadPlaceImage(file), 'https://example.test/photo.png');
    assert.equal(upload.mock.callCount(), 1);
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});
