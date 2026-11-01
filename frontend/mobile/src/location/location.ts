import * as Location from 'expo-location';
import { Linking } from 'react-native';

import type { PickedLocation } from './pickedLocation';

/** A point as react-native-maps takes it. The API order is the reverse: `[longitude, latitude]`. */
export type LatLng = PickedLocation;

/** FPT University HCMC, next to the seed data. Used when the user's position is unknown. */
export const DEFAULT_CENTER: LatLng = { latitude: 10.8414, longitude: 106.8097 };

/** The API rejects check-ins farther than this from the place. */
export const CHECKIN_RADIUS_M = 250;

export type LocationResult =
  | { status: 'granted'; coords: LatLng }
  /** `canAskAgain` false means only the system settings can grant it now. */
  | { status: 'denied'; canAskAgain: boolean }
  | { status: 'unavailable' };

/** A fix this recent and this precise is reused instead of waiting for a new GPS reading. */
const RECENT_FIX = { maxAge: 30_000, requiredAccuracy: 50 };

/**
 * Asks for permission if needed, then reads the position. Never throws.
 * A recent precise fix is returned at once; otherwise it waits for GPS, which can take seconds.
 */
export async function getCurrentLocation({ ask = true } = {}): Promise<LocationResult> {
  try {
    let permission = await Location.getForegroundPermissionsAsync();
    if (permission.status !== 'granted' && ask && permission.canAskAgain) {
      permission = await Location.requestForegroundPermissionsAsync();
    }
    if (permission.status !== 'granted') return { status: 'denied', canAskAgain: permission.canAskAgain };
    const position =
      (await Location.getLastKnownPositionAsync(RECENT_FIX)) ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }));
    return { status: 'granted', coords: { latitude: position.coords.latitude, longitude: position.coords.longitude } };
  } catch {
    return { status: 'unavailable' };
  }
}

export function openLocationSettings(): void {
  Linking.openSettings().catch(() => undefined);
}

/** API `[longitude, latitude]` to a map point. */
export function fromCoordinates(coordinates: number[] | undefined): LatLng | null {
  if (!coordinates || coordinates.length !== 2) return null;
  return { latitude: coordinates[1], longitude: coordinates[0] };
}

/** Great-circle distance in meters. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

/** 380 -> "380 m", 1400 -> "1,4 km". */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}
