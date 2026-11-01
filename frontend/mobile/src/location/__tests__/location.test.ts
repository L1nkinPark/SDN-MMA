import { distanceMeters, formatDistance, fromCoordinates } from '../location';

jest.mock('expo-location', () => ({}));

describe('location helpers', () => {
  it('reads API [longitude, latitude] into a map point', () => {
    expect(fromCoordinates([106.8097, 10.8414])).toEqual({ latitude: 10.8414, longitude: 106.8097 });
    expect(fromCoordinates(undefined)).toBeNull();
    expect(fromCoordinates([1])).toBeNull();
  });

  it('measures short distances in meters', () => {
    // Thư viện FPT to Passio Coffee in the seed data: about 40 m apart.
    const library = { latitude: 10.84142, longitude: 106.81004 };
    const passio = { latitude: 10.841457, longitude: 106.809666 };
    const meters = distanceMeters(library, passio);
    expect(meters).toBeGreaterThan(35);
    expect(meters).toBeLessThan(45);
  });

  it('formats meters and kilometers the Vietnamese way', () => {
    expect(formatDistance(379.6)).toBe('380 m');
    expect(formatDistance(1400)).toBe('1,4 km');
  });
});
