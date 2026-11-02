import { markerOffsets } from '../markerOffsets';

const fpt = { id: 'fpt', position: { latitude: 10.845, longitude: 106.804 } };
const passio = { id: 'passio', position: { latitude: 10.841457, longitude: 106.809666 } };
const library = { id: 'library', position: { latitude: 10.84142, longitude: 106.81004 } };

describe('markerOffsets', () => {
  it('leaves places that are far apart where they are', () => {
    expect(markerOffsets([fpt, passio]).get('fpt')).toBe(0);
    expect(markerOffsets([fpt, passio]).get('passio')).toBe(0);
  });

  it('spreads close places sideways, keeping west on the left', () => {
    const offsets = markerOffsets([library, fpt, passio]);
    expect(offsets.get('fpt')).toBe(0);
    expect(offsets.get('passio')).toBe(-10);
    expect(offsets.get('library')).toBe(10);
  });
});
