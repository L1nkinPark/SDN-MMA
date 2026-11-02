import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { errorMessage, errorStatus } from '@/api/errors';
import { useCheckin } from '@/api/hooks/useCheckin';
import { usePlace } from '@/api/hooks/usePlace';
import type { CheckinCrowd, CheckinNoise, CheckinResponse } from '@/api/types';
import { useSession } from '@/auth/session';
import {
  ActionBar,
  Button,
  Header,
  Icon,
  LiveStatusBars,
  LiveStatusLarge,
  LoadingList,
  MessageState,
  Screen,
} from '@/components';
import {
  CHECKIN_RADIUS_M,
  distanceMeters,
  formatDistance,
  fromCoordinates,
  getCurrentLocation,
  openLocationSettings,
  type LatLng,
} from '@/location/location';
import { useCurrentLocation } from '@/location/useCurrentLocation';
import { colors, fonts, sizes, spacing, type } from '@/theme';
import type { MeterLevel } from '@/utils/liveStatus';

const TOO_FAR_MESSAGE = `Chỉ check-in được khi ở trong bán kính ${CHECKIN_RADIUS_M} m.`;
const NO_FIX_MESSAGE = 'Chưa lấy được vị trí của bạn. Bật GPS rồi thử lại.';

const crowdOptions: { value: CheckinCrowd; label: string; level: MeterLevel }[] = [
  { value: 'low', label: 'Vắng', level: 1 },
  { value: 'medium', label: 'Vừa', level: 2 },
  { value: 'high', label: 'Đông', level: 3 },
];

const noiseOptions: { value: CheckinNoise; label: string; level: MeterLevel }[] = [
  { value: 'quiet', label: 'Yên tĩnh', level: 1 },
  { value: 'moderate', label: 'Vừa', level: 2 },
  { value: 'loud', label: 'Ồn', level: 3 },
];

/** A 72px tile with the level bars above the label. */
function ChoiceTile({ label, level, selected, onPress }: { label: string; level: MeterLevel; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[styles.tile, selected ? styles.tileSelected : null]}>
      <LiveStatusBars level={level} inverse={selected} />
      <Text style={[styles.tileLabel, selected ? styles.tileLabelSelected : null]}>{label}</Text>
    </Pressable>
  );
}

function ChoiceGroup<T extends string>({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: { value: T; label: string; level: MeterLevel }[];
  value: T | undefined;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel={title}>
      <Text style={styles.groupTitle}>{title}</Text>
      <View style={styles.tiles}>
        {options.map((option) => (
          <ChoiceTile
            key={option.value}
            label={option.label}
            level={option.level}
            selected={value === option.value}
            onPress={() => onChange(option.value)}
          />
        ))}
      </View>
    </View>
  );
}

/** Minutes until the check-in expires; the backend default is 120. */
function validMinutes(result: CheckinResponse): number {
  const expires = result.checkin?.expiresAt ? new Date(result.checkin.expiresAt).getTime() : NaN;
  if (Number.isNaN(expires)) return 120;
  return Math.max(1, Math.round((expires - Date.now()) / 60000));
}

/** Screen 6. Sends a fresh position with the answer; the API checks the 250 m radius and 15-minute cooldown. */
export default function CheckinScreen() {
  const { id, visitCode } = useLocalSearchParams<{ id: string; visitCode?: string }>();
  const { status: sessionStatus } = useSession();
  const placeQuery = usePlace(id);
  const location = useCurrentLocation();
  const checkin = useCheckin(id);
  const [crowd, setCrowd] = useState<CheckinCrowd>();
  const [noise, setNoise] = useState<CheckinNoise>();
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<{ message: string; blocking: boolean; at: LatLng | null } | null>(null);
  const [result, setResult] = useState<CheckinResponse | null>(null);

  const place = placeQuery.data?.place;

  let body;
  if (sessionStatus === 'guest') {
    body = (
      <MessageState
        heading="Đăng nhập để check-in"
        sentence="Check-in được tính điểm theo tài khoản của bạn."
        action={{ label: 'Đăng nhập', variant: 'primary', onPress: () => router.push('/login') }}
      />
    );
  } else if (placeQuery.isPending) {
    body = <LoadingList rows={2} />;
  } else if (!place) {
    body = (
      <MessageState
        tone="error"
        heading="Chưa tải được địa điểm"
        sentence={errorMessage(placeQuery.error)}
        action={{ label: 'Thử lại', onPress: () => placeQuery.refetch(), busy: placeQuery.isFetching }}
      />
    );
  } else if (location.status === 'denied') {
    body = (
      <MessageState
        heading="Cần quyền vị trí để check-in"
        sentence="App chỉ dùng vị trí để xác nhận bạn đang ở gần địa điểm."
        action={
          location.canAskAgain
            ? { label: 'Cho phép vị trí', variant: 'primary', onPress: location.refresh }
            : { label: 'Mở cài đặt', variant: 'primary', onPress: openLocationSettings }
        }
      />
    );
  } else if (result) {
    body = (
      <View style={styles.success}>
        <View style={styles.successText}>
          <Text accessibilityRole="header" style={type.heading}>
            Đã ghi nhận check-in
          </Text>
          <Text style={type.body}>Thông tin của bạn có hiệu lực trong {validMinutes(result)} phút. Trạng thái hiện tại:</Text>
        </View>
        <LiveStatusLarge liveStatus={result.liveStatus} />
        <Button label="Về địa điểm" variant="secondary" onPress={() => router.back()} style={styles.successButton} />
      </View>
    );
  }

  if (body) {
    return (
      <Screen>
        <Header title="Check-in" back />
        {body}
      </Screen>
    );
  }

  const target = fromCoordinates(place?.location?.coordinates);
  const distance = location.coords && target ? distanceMeters(location.coords, target) : null;
  const tooFar = distance !== null && distance > CHECKIN_RADIUS_M;
  // A blocking error (403 or 429) stays until the position changes.
  const blocked = Boolean(error?.blocking && error.at === location.coords);
  const alert = tooFar ? TOO_FAR_MESSAGE : error && (!error.blocking || blocked) ? error.message : null;
  const busy = locating || checkin.isPending;

  const distanceLine =
    location.status === 'loading'
      ? 'Đang xác định vị trí của bạn...'
      : distance === null
        ? 'Chưa xác định được vị trí của bạn'
        : `Bạn đang cách địa điểm ${formatDistance(distance)}`;

  const submit = async () => {
    if (!crowd || !noise) return;
    setError(null);
    setLocating(true);
    const current = await getCurrentLocation();
    setLocating(false);
    if (current.status !== 'granted') {
      if (current.status === 'denied') location.refresh();
      else setError({ message: NO_FIX_MESSAGE, blocking: false, at: location.coords });
      return;
    }
    checkin.mutate(
      { crowd, noise, coordinates: [current.coords.longitude, current.coords.latitude],
        ...(visitCode ? { visitCode, accuracyMeters: current.accuracyMeters ?? 10000 } : {}) },
      {
        onSuccess: setResult,
        onError: (failure) => {
          const status = errorStatus(failure);
          setError({ message: errorMessage(failure), blocking: status === 403 || status === 429, at: location.coords });
        },
      },
    );
  };

  return (
    <Screen>
      <Header title="Check-in" back />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.placeName}>{place?.name}</Text>
        <View style={styles.distance}>
          <Icon name="pin" color={colors.text} />
          <Text style={styles.distanceText}>{distanceLine}</Text>
          {location.status === 'unavailable' ? (
            <Pressable accessibilityRole="button" onPress={location.refresh} style={styles.retry}>
              <Text style={styles.retryText}>Thử lại</Text>
            </Pressable>
          ) : null}
        </View>

        <ChoiceGroup title="Chỗ này đang đông không?" options={crowdOptions} value={crowd} onChange={setCrowd} />
        <ChoiceGroup title="Có ồn không?" options={noiseOptions} value={noise} onChange={setNoise} />

        <Button label={visitCode ? 'Đã quét mã QR của quán' : 'Quét QR tại quầy để xác minh lượt ghé'} variant="secondary"
          onPress={() => router.push({ pathname: '/places/[id]/scan', params: { id } })} />

        {alert ? (
          <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.alert}>
            {alert}
          </Text>
        ) : (
          <Text style={type.secondary}>Lần check-in đầu tiên trong ngày ở đây được +1 điểm.</Text>
        )}
      </ScrollView>

      <ActionBar>
        <Button
          label="Gửi check-in"
          busyLabel="Đang gửi"
          block
          busy={busy}
          disabled={!crowd || !noise || tooFar || blocked}
          onPress={submit}
        />
      </ActionBar>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 22, paddingTop: spacing.xl, paddingBottom: spacing.xl, paddingLeft: spacing.contentLeft, paddingRight: spacing.contentRight },
  placeName: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 22, color: colors.text },
  distance: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  distanceText: { flexShrink: 1, fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: colors.text },
  retry: { minHeight: sizes.touchTarget, justifyContent: 'center', marginLeft: 'auto' },
  retryText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  group: { gap: 10 },
  groupTitle: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22, color: colors.text },
  tiles: { flexDirection: 'row', gap: spacing.sm },
  tile: {
    flex: 1,
    minHeight: 72,
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.fieldLine,
    borderRadius: sizes.radius,
  },
  tileSelected: { borderColor: colors.ink, backgroundColor: colors.ink },
  tileLabel: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  tileLabelSelected: { color: colors.onInk },
  alert: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: colors.error },
  success: { gap: spacing.xl, paddingTop: spacing.xxxl, paddingLeft: spacing.contentLeft, paddingRight: spacing.contentRight },
  successText: { gap: spacing.sm },
  successButton: { marginTop: spacing.xs },
});
