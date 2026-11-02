import type { ConfigContext, ExpoConfig } from 'expo/config';

// Android builds read the Google Maps key from .env so it stays out of git. Expo Go uses its own key.
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  plugins: [
    ...(config.plugins ?? []),
    ['react-native-maps', { androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY }],
  ],
});
