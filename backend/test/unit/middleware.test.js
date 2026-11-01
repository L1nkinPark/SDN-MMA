import { test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import multer from 'multer';
import { User } from '../../src/models/index.js';
import { requireAdmin, requireAuth } from '../../src/middleware/auth.js';
import { errorHandler } from '../../src/middleware/error.js';
import { HttpError } from '../../src/utils/common.js';

const cfg = { accessSecret: 'middleware-access-secret-1234567890-abc' };
const userId = '507f1f77bcf86cd799439011';

async function runAuth(header) {
  let outcome;
  const req = { headers: { authorization: header } };
  await requireAuth(cfg)(req, {}, error => { outcome = error || 'allowed'; });
  return { req, outcome };
}

test('authentication rejects missing, invalid, and wrong-purpose tokens', async () => {
  assert.equal((await runAuth(undefined)).outcome.status, 401);
  assert.equal((await runAuth('Bearer invalid')).outcome.status, 401);
  const refresh = jwt.sign({ sub: userId, type: 'refresh' }, cfg.accessSecret);
  assert.equal((await runAuth(`Bearer ${refresh}`)).outcome.status, 401);
  const wrongId = jwt.sign({ sub: 'bad-id', type: 'access' }, cfg.accessSecret);
  assert.equal((await runAuth(`Bearer ${wrongId}`)).outcome.status, 401);
  const wrongAlgorithm = jwt.sign({ sub: userId, type: 'access' }, cfg.accessSecret, { algorithm: 'HS512' });
  assert.equal((await runAuth(`Bearer ${wrongAlgorithm}`)).outcome.status, 401);
});

test('authentication loads the current user and blocks deleted accounts', async t => {
  const currentUser = { _id: userId, role: 'student' };
  const lookup = t.mock.method(User, 'findById', async id => {
    assert.equal(id, userId);
    return currentUser;
  });
  const token = jwt.sign({ sub: userId, type: 'access' }, cfg.accessSecret);
  const allowed = await runAuth(`Bearer ${token}`);
  assert.equal(allowed.outcome, 'allowed');
  assert.equal(allowed.req.user, currentUser);
  lookup.mock.mockImplementation(async () => null);
  assert.equal((await runAuth(`Bearer ${token}`)).outcome.status, 401);
});

test('admin guard checks the authenticated user role', () => {
  const run = user => {
    let outcome;
    requireAdmin({ user }, {}, error => { outcome = error || 'allowed'; });
    return outcome;
  };
  assert.equal(run({ role: 'admin' }), 'allowed');
  assert.equal(run({ role: 'student' }).status, 403);
  assert.equal(run(undefined).status, 403);
});

test('error responses map validation, duplicate, cast, and internal failures', t => {
  const logged = t.mock.method(console, 'error', () => {});
  const respond = error => {
    const response = { code: null, body: null,
      status(code) { this.code = code; return this; },
      json(body) { this.body = body; return this; }
    };
    errorHandler(error, {}, response, () => {});
    return response;
  };
  assert.equal(respond(new multer.MulterError('LIMIT_FILE_SIZE')).code, 400);
  assert.equal(respond({ code: 11000 }).code, 409);
  assert.equal(respond(new mongoose.Error.CastError('ObjectId', 'bad', '_id')).code, 400);
  assert.deepEqual(respond(new HttpError(403, 'Forbidden')).body, { error: 'Forbidden' });
  assert.deepEqual(respond(new Error('secret detail')).body, { error: 'Internal server error' });
  assert.equal(logged.mock.callCount(), 1);
});
