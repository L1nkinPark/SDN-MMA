import { describe, expect, it } from 'vitest';

import { auditActionLabel } from '../labels';
import { hasPermission, isSuperAdmin, usesMerchantArea } from '../permissions';
import { bookingActionsAt, dateKeyLabel, vnDateKey, vnDateTime } from '../vnTime';

describe('admin permissions', () => {
  it('mirrors the backend: no list means every permission', () => {
    expect(hasPermission({ role: 'admin' }, 'users')).toBe(true);
    expect(hasPermission({ role: 'admin', adminPermissions: ['*'] }, 'fraud')).toBe(true);
    expect(hasPermission({ role: 'admin', adminPermissions: ['places'] }, 'places')).toBe(true);
    expect(hasPermission({ role: 'admin', adminPermissions: ['places'] }, 'users')).toBe(false);
    expect(hasPermission({ role: 'merchant' }, 'places')).toBe(false);
  });

  it('knows super admins and merchant-area accounts', () => {
    expect(isSuperAdmin({ role: 'admin', adminPermissions: ['users'] })).toBe(false);
    expect(isSuperAdmin({ role: 'admin', adminPermissions: ['*'] })).toBe(true);
    expect(usesMerchantArea({ role: 'student' })).toBe(true);
    expect(usesMerchantArea({ role: 'admin' })).toBe(false);
  });
});

describe('Vietnam time', () => {
  it('formats in Vietnam time whatever the browser zone', () => {
    expect(vnDateKey(new Date('2026-11-03T18:30:00Z'))).toBe('2026-11-04');
    expect(vnDateTime('2026-11-04T03:00:00Z')).toBe('04/11/2026 10:00');
    expect(dateKeyLabel('2026-11-04')).toBe('04/11/2026');
  });
});

describe('merchant booking actions', () => {
  const start = '2026-11-04T03:00:00Z';
  const at = (minutes: number) => Date.parse(start) + minutes * 60000;

  it('approves or rejects a pending booking only before it starts', () => {
    expect(bookingActionsAt('pending', start, at(-60))).toEqual(['approve', 'reject']);
    expect(bookingActionsAt('pending', start, at(1))).toEqual([]);
  });

  it('follows the 15 minute arrival window for confirmed bookings', () => {
    expect(bookingActionsAt('confirmed', start, at(-60))).toEqual(['cancel']);
    expect(bookingActionsAt('confirmed', start, at(-10))).toEqual(['arrived', 'cancel']);
    expect(bookingActionsAt('confirmed', start, at(10))).toEqual(['arrived']);
    expect(bookingActionsAt('confirmed', start, at(20))).toEqual(['no_show']);
  });

  it('offers nothing for finished bookings', () => {
    expect(bookingActionsAt('completed', start, at(0))).toEqual([]);
  });
});

describe('audit labels', () => {
  it('translates known actions and keeps unknown ones', () => {
    expect(auditActionLabel('claim.approved')).toBe('Duyệt hồ sơ chủ quán');
    expect(auditActionLabel('something.new')).toBe('Thao tác khác (something.new)');
  });
});

describe('fraud detail', () => {
  it('turns the backend detail into Vietnamese', async () => {
    const { fraudDetailText } = await import('../labels');
    expect(fraudDetailText('12 km in 3 minutes')).toBe('Di chuyển 12 km trong 3 phút giữa hai lần check-in.');
    expect(fraudDetailText('???')).toContain('quá xa');
  });
});
