import { distanceMeters, type LatLng } from '@/location/location';

/** Places closer than this overlap at the zoom that fits a neighbourhood. */
const CLOSE_METERS = 100;
/** Sideways distance between markers of one group; 20 is the marker size. */
const GAP = 20;

/** Sideways shift per place, so that places almost on the same spot stay separately tappable. */
export function markerOffsets(places: { id: string; position: LatLng }[]): Map<string, number> {
  const offsets = new Map<string, number>();
  const west = [...places].sort((a, b) => a.position.longitude - b.position.longitude);
  let start = 0;
  for (let end = 1; end <= west.length; end += 1) {
    if (end < west.length && distanceMeters(west[end - 1].position, west[end].position) < CLOSE_METERS) continue;
    const count = end - start;
    for (let i = start; i < end; i += 1) offsets.set(west[i].id, (i - start - (count - 1) / 2) * GAP);
    start = end;
  }
  return offsets;
}
