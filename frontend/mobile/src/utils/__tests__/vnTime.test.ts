import {
  isBookableStart,
  longDateLabel,
  nextDateKeys,
  shortDateLabel,
  slotStartTimes,
  vnDateKey,
  vnDateTime,
  vnInstant,
  vnTime,
  weekdayOf,
} from '../vnTime';

describe('Vietnam time', () => {
  it('uses the Vietnam calendar day, not the phone time zone', () => {
    // 18:30 UTC on 3 Nov is already 01:30 on 4 Nov in Vietnam.
    expect(vnDateKey(new Date('2026-11-03T18:30:00Z'))).toBe('2026-11-04');
    expect(vnTime('2026-11-03T18:30:00Z')).toBe('01:30');
  });

  it('builds the instant the backend expects', () => {
    expect(vnInstant('2026-11-04', '10:00').toISOString()).toBe('2026-11-04T03:00:00.000Z');
  });

  it('labels days with Sunday as 0', () => {
    expect(weekdayOf('2026-11-08')).toBe(0);
    expect(shortDateLabel('2026-11-04')).toBe('T4 04/11');
    expect(longDateLabel('2026-11-04')).toBe('Thứ tư, 04/11/2026');
    expect(vnDateTime('2026-11-04T03:00:00Z')).toBe('Thứ tư, 04/11/2026 · 10:00');
  });

  it('lists the next days across a month end', () => {
    expect(nextDateKeys(3, new Date('2026-11-29T20:00:00Z'))).toEqual(['2026-11-30', '2026-12-01', '2026-12-02']);
  });
});

describe('slot start times', () => {
  it('fits hour slots inside opening hours', () => {
    expect(slotStartTimes('08:00', '11:00', 60)).toEqual(['08:00', '09:00', '10:00']);
  });

  it('rounds a half-hour opening up to the next allowed start', () => {
    expect(slotStartTimes('08:30', '10:30', 60)).toEqual(['09:00']);
    expect(slotStartTimes('08:30', '10:00', 30)).toEqual(['08:30', '09:00', '09:30']);
  });

  it('starts two-hour slots on even hours only', () => {
    expect(slotStartTimes('07:00', '14:00', 120)).toEqual(['08:00', '10:00', '12:00']);
  });

  it('returns nothing when no slot fits', () => {
    expect(slotStartTimes('08:00', '08:45', 60)).toEqual([]);
  });
});

describe('booking window', () => {
  const now = Date.parse('2026-11-04T03:00:00Z');
  it('needs at least 1 hour and at most 14 days', () => {
    expect(isBookableStart(new Date(now + 59 * 60000), now)).toBe(false);
    expect(isBookableStart(new Date(now + 60 * 60000), now)).toBe(true);
    expect(isBookableStart(new Date(now + 15 * 86400000), now)).toBe(false);
  });
});
