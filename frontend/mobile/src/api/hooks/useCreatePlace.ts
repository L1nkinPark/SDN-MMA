import { useMutation } from '@tanstack/react-query';

import { placesApi } from '../places';
import type { PlaceInput } from '../types';

/** `POST /api/places`. Student submissions start as pending and don't appear in public lists. */
export function useCreatePlace() {
  return useMutation({ mutationFn: (input: PlaceInput) => placesApi.create(input) });
}
