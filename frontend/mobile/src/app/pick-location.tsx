import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { type Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Icon } from '@/components';
import { DEFAULT_CENTER, getCurrentLocation, openLocationSettings, type LatLng } from '@/location/location';
import { formatPickedLocation, getPickedLocation, setPickedLocation } from '@/location/pickedLocation';
import { colors, sizes, spacing, type } from '@/theme';

const DELTA = { latitudeDelta: 0.005, longitudeDelta: 0.005 };
const PIN_SIZE = 40;

function back() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/**
 * Screen 15, opened from /propose. The pin stays in the middle and the map moves under it.
 * "Xác nhận vị trí" stores the point with `setPickedLocation` and goes back; /propose reads it.
 */
export default function PickLocationScreen() {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const [initial] = useState(getPickedLocation);
  const [center, setCenter] = useState<LatLng>(initial ?? DEFAULT_CENTER);
  // Coordinates are shown once there is a real point: an earlier pick, the user's position or a drag.
  const [hasPoint, setHasPoint] = useState(initial !== null);
  const [noLocation, setNoLocation] = useState(false);
  const [locating, setLocating] = useState(false);

  const moveTo = (coords: LatLng) => {
    mapRef.current?.animateToRegion({ ...coords, ...DELTA });
    setCenter(coords);
    setHasPoint(true);
  };

  // Start at the user's position when nothing was picked yet.
  useEffect(() => {
    if (initial) return;
    let active = true;
    getCurrentLocation().then((result) => {
      if (!active) return;
      if (result.status === 'granted') {
        mapRef.current?.animateToRegion({ ...result.coords, ...DELTA });
        setCenter(result.coords);
        setHasPoint(true);
      } else {
        setNoLocation(true);
      }
    });
    return () => {
      active = false;
    };
  }, [initial]);

  const locateMe = async () => {
    setLocating(true);
    const result = await getCurrentLocation();
    setLocating(false);
    if (result.status === 'granted') {
      setNoLocation(false);
      moveTo(result.coords);
    } else {
      setNoLocation(true);
      if (result.status === 'denied' && !result.canAskAgain) openLocationSettings();
    }
  };

  const onRegionChangeComplete = (region: Region, details?: { isGesture?: boolean }) => {
    setCenter({ latitude: region.latitude, longitude: region.longitude });
    if (details?.isGesture) setHasPoint(true);
  };

  const confirm = () => {
    setPickedLocation(center);
    back();
  };

  return (
    <View style={styles.screen}>
      <View style={styles.mapWrap}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          initialRegion={{ ...center, ...DELTA }}
          toolbarEnabled={false}
          onRegionChangeComplete={onRegionChangeComplete}
        />
        {/* The tip of the pin marks the map center. */}
        <View pointerEvents="none" style={styles.pin}>
          <Icon name="pin" size={PIN_SIZE} color={colors.error} filled />
          <View style={styles.pinDot} />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
          onPress={back}
          style={[styles.squareButton, styles.back, { top: Math.max(insets.top, 24) + 8 }]}>
          <Icon name="back" color={colors.ink} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Về vị trí của tôi"
          accessibilityState={{ busy: locating }}
          disabled={locating}
          onPress={locateMe}
          style={[styles.squareButton, styles.locate, locating ? styles.busy : null]}>
          <Icon name="locate" color={colors.ink} />
        </Pressable>
      </View>

      <View style={styles.panel}>
        <View style={styles.panelText}>
          <Text accessibilityRole="header" style={type.heading}>
            Kéo bản đồ để chọn vị trí
          </Text>
          <Text style={styles.coords}>
            {hasPoint || !noLocation ? formatPickedLocation(center) : 'Chưa có vị trí hiện tại, kéo bản đồ để chọn thủ công'}
          </Text>
        </View>
        <View style={[styles.actions, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
          <Button label="Xác nhận vị trí" block onPress={confirm} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  mapWrap: { flex: 1 },
  pin: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: PIN_SIZE,
    height: PIN_SIZE,
    marginLeft: -PIN_SIZE / 2,
    // The pin path ends at y=21 of 24, so lift it by that much.
    marginTop: -PIN_SIZE * (21 / 24),
    alignItems: 'center',
  },
  pinDot: {
    position: 'absolute',
    top: PIN_SIZE * (7 / 24),
    width: PIN_SIZE * (5 / 24),
    height: PIN_SIZE * (5 / 24),
    borderRadius: PIN_SIZE,
    backgroundColor: colors.paper,
  },
  squareButton: {
    position: 'absolute',
    width: sizes.touchTarget,
    height: sizes.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: sizes.radius,
    backgroundColor: colors.paper,
  },
  back: { left: spacing.contentRight },
  locate: { right: spacing.contentRight, bottom: spacing.lg },
  busy: { opacity: 0.5 },
  panel: { borderTopWidth: sizes.titleRule, borderTopColor: colors.ink, backgroundColor: colors.paper },
  panelText: { gap: 2, paddingTop: spacing.lg, paddingLeft: spacing.contentRight, paddingRight: spacing.contentRight },
  actions: { paddingTop: spacing.md, paddingLeft: spacing.contentRight, paddingRight: spacing.contentRight },
  coords: { ...type.body, fontSize: 14, lineHeight: 20, fontVariant: ['tabular-nums'] },
});
