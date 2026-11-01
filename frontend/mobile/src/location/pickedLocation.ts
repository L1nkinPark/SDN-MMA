import { useSyncExternalStore } from 'react';

/** A point chosen on /pick-location, read by /propose. */
export type PickedLocation = { latitude: number; longitude: number };

let current: PickedLocation | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

/** Called by /pick-location when the user confirms a point. */
export function setPickedLocation(location: PickedLocation): void {
  current = { latitude: location.latitude, longitude: location.longitude };
  emit();
}

export function clearPickedLocation(): void {
  current = null;
  emit();
}

export function getPickedLocation(): PickedLocation | null {
  return current;
}

export function subscribePickedLocation(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function usePickedLocation(): PickedLocation | null {
  return useSyncExternalStore(subscribePickedLocation, getPickedLocation, getPickedLocation);
}

/** API order: `[longitude, latitude]`. */
export function toCoordinates(location: PickedLocation): [number, number] {
  return [location.longitude, location.latitude];
}

/** "10.84500, 106.80400" (latitude first, as people read it). */
export function formatPickedLocation(location: PickedLocation): string {
  return `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`;
}
