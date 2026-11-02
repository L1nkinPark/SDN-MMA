import type { Approval, Place, PlaceInput, PlaceUpdate } from '../api/types';

function sameCoordinates(a: number[] | undefined, b: number[]): boolean {
  return Boolean(a) && a!.length === 2 && a![0] === b[0] && a![1] === b[1];
}

/** Only the fields that changed, so PATCH never rewrites what the admin didn't touch. */
export function placeChanges(place: Place, input: PlaceInput, approval: Approval): PlaceUpdate {
  const changes: PlaceUpdate = {};
  if (input.name !== (place.name ?? '')) changes.name = input.name;
  if (input.address !== (place.address ?? '')) changes.address = input.address;
  if ((input.description ?? '') !== (place.description ?? '')) changes.description = input.description ?? '';
  if (!sameCoordinates(place.location?.coordinates, input.coordinates)) changes.coordinates = input.coordinates;
  const wifi = input.amenities?.wifi ?? null;
  const outlets = input.amenities?.outlets ?? null;
  if (wifi !== (place.amenities?.wifi ?? null) || outlets !== (place.amenities?.outlets ?? null)) {
    changes.amenities = { wifi, outlets };
  }
  if ((input.minDrinkPrice ?? null) !== (place.minDrinkPrice ?? null)) changes.minDrinkPrice = input.minDrinkPrice ?? null;
  if (approval !== place.approval) changes.approval = approval;
  return changes;
}
