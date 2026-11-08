import { describe, expect, it } from 'vitest';

import type { Place } from '../../api/types';
import { settingsChanges, settingsFromPlace, upcomingDates, validateSettings } from '../merchantForm';
import { evidenceError, parseCount, parseLinks, phoneError, reasonError } from '../validation';

const TODAY = '2026-11-08';

const place: Place = {
  _id: 'p1',
  name: 'Quán Học',
  approval: 'approved',
  amenities: { wifi: true, outlets: null },
  minDrinkPrice: 25000,
  business: {
    phone: '0901234567',
    openingHours: [
      { day: 1, open: '08:00', close: '22:00' },
      { day: 2, open: '08:00', close: '22:00' },
    ],
    closedDates: ['2026-11-01', '2026-12-24'],
    temporaryClosed: false,
    seatingCapacity: 30,
  },
  booking: { enabled: true, slotMinutes: 60, approvalMode: 'auto', capacityPerSlot: 4 },
};

describe('merchant settings form', () => {
  it('round-trips the place without changes and drops past closed dates', () => {
    const values = settingsFromPlace(place, TODAY);
    expect(values.closedDates).toEqual(['2026-12-24']);
    expect(values.hours.filter((item) => item.open).map((item) => item.day)).toEqual([1, 2]);
    expect(settingsChanges(place, values, TODAY)).toEqual({});
    expect(validateSettings(values)).toEqual({});
  });

  it('sends only the changed fields in the API shape', () => {
    const values = settingsFromPlace(place, TODAY);
    values.capacityPerSlot = '6';
    values.price = '';
    values.hours[0] = { day: 0, open: true, from: '09:00', to: '17:00' };
    values.closedDates = ['2026-12-31', '2026-12-24'];
    expect(settingsChanges(place, values, TODAY)).toEqual({
      capacityPerSlot: 6,
      minDrinkPrice: null,
      openingHours: [
        { day: 0, open: '09:00', close: '17:00' },
        { day: 1, open: '08:00', close: '22:00' },
        { day: 2, open: '08:00', close: '22:00' },
      ],
      closedDates: ['2026-12-24', '2026-12-31'],
    });
  });

  it('refuses hours that close before they open and booking without capacity', () => {
    const values = settingsFromPlace(place, TODAY);
    values.hours[1] = { day: 1, open: true, from: '22:00', to: '08:00' };
    values.capacityPerSlot = '';
    const errors = validateSettings(values);
    expect(errors.hours).toContain('trước giờ đóng cửa');
    expect(errors.capacityPerSlot).toBe('Cần số chỗ mỗi khung giờ để nhận đặt chỗ.');
  });

  it('refuses booking capacity above the physical seating capacity', () => {
    const values = settingsFromPlace(place, TODAY);
    values.seatingCapacity = '3';
    expect(validateSettings(values).capacityPerSlot).toContain('không được vượt quá');
  });

  it('keeps only upcoming unique dates', () => {
    expect(upcomingDates(['2026-11-09', '2026-11-07', '2026-11-09'], TODAY)).toEqual(['2026-11-09']);
  });
});

describe('merchant validators', () => {
  it('checks phones, counts and reasons like the backend', () => {
    expect(phoneError('0901')).toBe('Số điện thoại cần 8 đến 20 ký tự.');
    expect(phoneError('0901 234 567')).toBeNull();
    expect(parseCount('')).toBeNull();
    expect(parseCount('0')).toBeUndefined();
    expect(parseCount('12')).toBe(12);
    expect(reasonError('', false)).toBeNull();
    expect(reasonError('abc', false)).toBe('Lý do cần ít nhất 5 ký tự.');
    expect(reasonError('', true)).toBe('Ghi lý do (ít nhất 5 ký tự).');
  });

  it('accepts 1 to 5 HTTPS evidence links', () => {
    expect(parseLinks('https://a.vn/1\n https://a.vn/2 ,')).toEqual(['https://a.vn/1', 'https://a.vn/2']);
    expect(evidenceError('')).toContain('ít nhất một link');
    expect(evidenceError('http://a.vn/x')).toBe('Link phải bắt đầu bằng https:// (http://a.vn/x).');
    expect(evidenceError('https://a.vn/x')).toBeNull();
    expect(evidenceError(Array.from({ length: 6 }, (_, i) => `https://a.vn/${i}`).join('\n'))).toBe('Tối đa 5 link minh chứng.');
  });
});
