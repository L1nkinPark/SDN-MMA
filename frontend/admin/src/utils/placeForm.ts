import type { Place, PlaceInput } from '../api/types';
import {
  addressError,
  descriptionError,
  latitudeError,
  longitudeError,
  parseDecimal,
  parsePrice,
  placeNameError,
  priceError,
} from './validation';

export type Amenity = boolean | null;

export const AMENITY_OPTIONS: { value: Amenity; label: string }[] = [
  { value: true, label: 'Có' },
  { value: false, label: 'Không' },
  { value: null, label: 'Chưa rõ' },
];

export type Values = {
  name: string;
  address: string;
  description: string;
  latitude: string;
  longitude: string;
  wifi: Amenity;
  outlets: Amenity;
  price: string;
};

export type Field = 'name' | 'address' | 'description' | 'latitude' | 'longitude' | 'price';

export function initialValues(place?: Place): Values {
  const [lng, lat] = place?.location?.coordinates ?? [];
  return {
    name: place?.name ?? '',
    address: place?.address ?? '',
    description: place?.description ?? '',
    latitude: typeof lat === 'number' ? String(lat) : '',
    longitude: typeof lng === 'number' ? String(lng) : '',
    wifi: place?.amenities?.wifi ?? null,
    outlets: place?.amenities?.outlets ?? null,
    price: typeof place?.minDrinkPrice === 'number' ? String(place.minDrinkPrice) : '',
  };
}

export function validate(values: Values): Record<Field, string | null> {
  return {
    name: placeNameError(values.name),
    address: addressError(values.address),
    description: descriptionError(values.description),
    latitude: latitudeError(values.latitude),
    longitude: longitudeError(values.longitude),
    price: priceError(values.price),
  };
}

/** Values as the API expects them: trimmed text, `[longitude, latitude]`, null for unknown. */
export function toPlaceInput(values: Values): PlaceInput {
  return {
    name: values.name.trim(),
    address: values.address.trim(),
    description: values.description.trim(),
    coordinates: [parseDecimal(values.longitude) as number, parseDecimal(values.latitude) as number],
    amenities: { wifi: values.wifi, outlets: values.outlets },
    minDrinkPrice: parsePrice(values.price) ?? null,
  };
}

export const EMPTY_ERRORS: Record<Field, string | null> = {
  name: null,
  address: null,
  description: null,
  latitude: null,
  longitude: null,
  price: null,
};
