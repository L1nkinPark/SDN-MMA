import { formatDate, formatRating, formatThousands } from '../format';
import { crowdLevel, isStatusKnown, levelLabel, noiseLevel } from '../liveStatus';

describe('format', () => {
  it('uses a comma for decimals', () => {
    expect(formatRating(4.6)).toBe('4,6');
    expect(formatRating(4)).toBe('4,0');
  });

  it('groups thousands with dots', () => {
    expect(formatThousands(25000)).toBe('25.000');
    expect(formatThousands(1250000)).toBe('1.250.000');
    expect(formatThousands(900)).toBe('900');
  });

  it('formats dates as dd/mm/yyyy and ignores bad input', () => {
    expect(formatDate(new Date(2026, 9, 2).toISOString())).toBe('02/10/2026');
    expect(formatDate(undefined)).toBe('');
    expect(formatDate('nope')).toBe('');
  });
});

describe('live status', () => {
  it('maps levels and labels', () => {
    expect(crowdLevel('high')).toBe(3);
    expect(noiseLevel('quiet')).toBe(1);
    expect(crowdLevel('unknown')).toBe(0);
    expect(levelLabel('crowd', 1)).toBe('Vắng');
    expect(levelLabel('noise', 3)).toBe('Ồn');
  });

  it('treats unknown as not known', () => {
    expect(isStatusKnown({ crowd: 'unknown', noise: 'unknown' })).toBe(false);
    expect(isStatusKnown(undefined)).toBe(false);
    expect(isStatusKnown({ crowd: 'low', noise: 'loud' })).toBe(true);
  });
});
