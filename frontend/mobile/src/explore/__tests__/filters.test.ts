import { nextPlacePage } from '@/api/hooks/usePlaces';

import { countActiveFilters, DEFAULT_FILTERS, hidesUnverified, placeListQuery } from '../filters';

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

describe('placeListQuery', () => {
  const origin = { latitude: 10.77, longitude: 106.7 };

  it('stays near the user when browsing', () => {
    expect(placeListQuery(DEFAULT_FILTERS, '', origin)).toMatchObject({ lat: 10.77, lng: 106.7, radius: 5000 });
  });

  it.each([5000, 10000])('searches every place for a keyword with distance %d', (radius) => {
    const query = placeListQuery({ radius }, 'fpt', origin);
    expect(query).toMatchObject({ q: 'fpt' });
    expect(query).not.toHaveProperty('lat');
    expect(query).not.toHaveProperty('radius');
  });

  it('keeps other filters while searching', () => {
    expect(placeListQuery({ radius: 5000, wifi: true }, 'fpt', origin)).toMatchObject({ q: 'fpt', wifi: true });
  });

  it('sends no position when it is unknown', () => {
    expect(placeListQuery(DEFAULT_FILTERS, '', null)).not.toHaveProperty('lat');
  });
});

describe('nextPlacePage', () => {
  it('asks for the next page until every place is loaded', () => {
    expect(nextPlacePage({ page: 1, limit: 50, total: 120 })).toBe(2);
    expect(nextPlacePage({ page: 3, limit: 50, total: 120 })).toBeUndefined();
  });
});
