import { checkVisitCode } from '../visitCode';

function base64url(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function token(payload: object): string {
  return `${base64url({ alg: 'HS256', typ: 'JWT' })}.${base64url(payload)}.signature`;
}

describe('visit code', () => {
  const now = 1_800_000_000_000;
  const valid = token({ type: 'visit_qr', place: 'p1', owner: 'u1', exp: now / 1000 + 60 });

  it('accepts a fresh code for this place', () => {
    expect(checkVisitCode(valid, 'p1', now)).toEqual({ ok: true, code: valid, expiresAt: now + 60000 });
  });

  it('rejects codes for another place or past their expiry', () => {
    expect(checkVisitCode(valid, 'p2', now)).toEqual({ ok: false, reason: 'other-place' });
    expect(checkVisitCode(valid, 'p1', now + 61000)).toEqual({ ok: false, reason: 'expired' });
  });

  it('rejects anything that is not a StudySpot visit QR', () => {
    expect(checkVisitCode('https://example.com', 'p1', now)).toEqual({ ok: false, reason: 'format' });
    expect(checkVisitCode('a.b.c', 'p1', now)).toEqual({ ok: false, reason: 'format' });
    expect(checkVisitCode(token({ type: 'access', place: 'p1' }), 'p1', now)).toEqual({ ok: false, reason: 'format' });
  });
});
