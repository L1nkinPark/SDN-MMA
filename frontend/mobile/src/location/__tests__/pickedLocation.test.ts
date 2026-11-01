import {
  clearPickedLocation,
  formatPickedLocation,
  getPickedLocation,
  setPickedLocation,
  subscribePickedLocation,
  toCoordinates,
} from '../pickedLocation';

describe('picked location store', () => {
  afterEach(() => clearPickedLocation());

  it('stores the point and notifies listeners', () => {
    const listener = jest.fn();
    const unsubscribe = subscribePickedLocation(listener);
    setPickedLocation({ latitude: 10.845, longitude: 106.804 });
    expect(getPickedLocation()).toEqual({ latitude: 10.845, longitude: 106.804 });
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    clearPickedLocation();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getPickedLocation()).toBeNull();
  });

  it('converts to [longitude, latitude] for the API', () => {
    expect(toCoordinates({ latitude: 10.845, longitude: 106.804 })).toEqual([106.804, 10.845]);
  });

  it('formats with five decimals', () => {
    expect(formatPickedLocation({ latitude: 10.845, longitude: 106.804 })).toBe('10.84500, 106.80400');
  });
});
