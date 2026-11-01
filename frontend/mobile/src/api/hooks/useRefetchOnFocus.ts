import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';

/** Refetches when the screen regains focus (e.g. switching back to a tab), skipping the first focus. */
export function useRefetchOnFocus(refetch: () => unknown, enabled = true) {
  const first = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      if (enabled) refetch();
    }, [enabled, refetch]),
  );
}
