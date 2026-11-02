import { describe, expect, it } from 'vitest';

import type { Place } from '../../api/types';
import { amenityText, formatRating, priceText } from '../format';
import { initialValues, toPlaceInput, validate } from '../placeForm';
import { placeChanges } from '../placeDiff';
import { latitudeError, longitudeError, parsePrice } from '../validation';

const place: Place = {
  _id: 'p1',
  name: 'Thư viện',
  address: 'Đường D1, Khu Công nghệ cao',
  description: '',
  location: { type: 'Point', coordinates: [106.8098, 10.8411] },
  amenities: { wifi: null, outlets: true },
  minDrinkPrice: null,
  approval: 'pending',
};

describe('place form', () => {
  it('round-trips a place into the API shape with [longitude, latitude]', () => {
    const values = initialValues(place);
    expect(values.latitude).toBe('10.8411');
    expect(toPlaceInput(values).coordinates).toEqual([106.8098, 10.8411]);
    expect(Object.values(validate(values)).every((e) => e === null)).toBe(true);
  });

  it('sends only changed fields', () => {
    const input = toPlaceInput(initialValues(place));
    expect(placeChanges(place, input, 'pending')).toEqual({});
    expect(placeChanges(place, input, 'approved')).toEqual({ approval: 'approved' });
    expect(placeChanges(place, { ...input, name: 'Thư viện mới', amenities: { wifi: true, outlets: true } }, 'pending')).toEqual({
      name: 'Thư viện mới',
      amenities: { wifi: true, outlets: true },
    });
  });

  it('validates coordinates and prices', () => {
    expect(latitudeError('91')).not.toBeNull();
    expect(latitudeError('10,84')).toBeNull();
    expect(longitudeError('abc')).not.toBeNull();
    expect(parsePrice('')).toBeNull();
    expect(parsePrice('25.000')).toBe(25000);
    expect(parsePrice('25k')).toBeUndefined();
  });

  it('shows null as unverified', () => {
    expect(amenityText(null)).toBe('Chưa rõ');
    expect(amenityText(false)).toBe('Không');
    expect(priceText(null)).toBe('Chưa rõ');
    expect(priceText(25000)).toBe('25.000 đ');
    expect(formatRating(4.25)).toBe('4,3');
  });
});
