import { useSyncExternalStore } from 'react';

import type { Crowd, Noise } from '@/api/types';

/** Filters chosen on /filter and applied on Khám phá. Distance only applies when the location is known. */
export type PlaceFilters = {
  radius: number;
  wifi?: true;
  outlets?: true;
  maxPrice?: number;
  crowd?: Crowd;
  noise?: Noise;
};

export const RADIUS_OPTIONS = [1000, 3000, 5000, 10000] as const;
export const DEFAULT_FILTERS: PlaceFilters = { radius: 5000 };

let current: PlaceFilters = DEFAULT_FILTERS;
const listeners = new Set<() => void>();

export function setPlaceFilters(filters: PlaceFilters): void {
  current = filters;
  for (const listener of listeners) listener();
}

export function resetPlaceFilters(): void {
  setPlaceFilters(DEFAULT_FILTERS);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getFilters(): PlaceFilters {
  return current;
}

export function usePlaceFilters(): PlaceFilters {
  return useSyncExternalStore(subscribe, getFilters, getFilters);
}

/** Number shown as "Lọc (2)". A non-default distance counts as one. */
export function countActiveFilters(filters: PlaceFilters): number {
  const { radius, ...rest } = filters;
  return Object.values(rest).filter((value) => value !== undefined).length + (radius === DEFAULT_FILTERS.radius ? 0 : 1);
}

/** True when a filter that hides places with unverified data (null) is on. */
export function hidesUnverified(filters: PlaceFilters): boolean {
  return Boolean(filters.wifi || filters.outlets || filters.maxPrice !== undefined);
}
