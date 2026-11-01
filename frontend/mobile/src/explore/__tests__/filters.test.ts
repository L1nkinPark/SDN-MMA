import { nextPlacePage } from '@/api/hooks/usePlaces';

import { countActiveFilters, DEFAULT_FILTERS, hidesUnverified } from '../filters';

describe('place filters', () => {
  it('counts nothing for the defaults', () => {
    expect(countActiveFilters(DEFAULT_FILTERS)).toBe(0);
    expect(hidesUnverified(DEFAULT_FILTERS)).toBe(false);
  });

  it('counts each filter and a non-default distance', () => {
    expect(countActiveFilters({ radius: 3000, wifi: true, crowd: 'low' })).toBe(3);
  });

  it('knows which filters hide places with unverified data', () => {
    expect(hidesUnverified({ radius: 5000, crowd: 'low' })).toBe(false);
    expect(hidesUnverified({ radius: 5000, outlets: true })).toBe(true);
    expect(hidesUnverified({ radius: 5000, maxPrice: 0 })).toBe(true);
  });
});

describe('nextPlacePage', () => {
  it('asks for the next page until every place is loaded', () => {
    expect(nextPlacePage({ page: 1, limit: 50, total: 120 })).toBe(2);
    expect(nextPlacePage({ page: 3, limit: 50, total: 120 })).toBeUndefined();
  });
});
