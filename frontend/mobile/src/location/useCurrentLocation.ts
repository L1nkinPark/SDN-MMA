import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { getCurrentLocation, type LatLng } from './location';

export type CurrentLocation =
  | { status: 'loading'; coords: LatLng | null }
  | { status: 'granted'; coords: LatLng }
  | { status: 'denied'; coords: null; canAskAgain: boolean }
  | { status: 'unavailable'; coords: LatLng | null };

/**
 * The user's position, asked for once on mount. `refresh()` asks again (and prompts if allowed).
 * Coming back from the system settings re-checks without prompting.
 */
export function useCurrentLocation() {
  const [state, setState] = useState<CurrentLocation>({ status: 'loading', coords: null });
  const [request, setRequest] = useState({ attempt: 0, ask: true });

  useEffect(() => {
    let active = true;
    getCurrentLocation({ ask: request.ask }).then((result) => {
      if (!active) return;
      setState((previous) => {
        if (result.status === 'granted') return { status: 'granted', coords: result.coords };
        if (result.status === 'denied') return { status: 'denied', coords: null, canAskAgain: result.canAskAgain };
        return { status: 'unavailable', coords: previous.coords };
      });
    });
    return () => {
      active = false;
    };
  }, [request]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') setRequest((previous) => ({ attempt: previous.attempt + 1, ask: false }));
    });
    return () => subscription.remove();
  }, []);

  const refresh = useCallback(() => {
    setState((previous) => ({ status: 'loading', coords: previous.coords }));
    setRequest((previous) => ({ attempt: previous.attempt + 1, ask: true }));
  }, []);

  return { ...state, refresh };
}
