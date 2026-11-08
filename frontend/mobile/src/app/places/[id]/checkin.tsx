import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { errorMessage, errorStatus, isApiError } from '@/api/errors';
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
  QrScanner,
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
import { checkVisitCode, VERIFIED_MAX_ACCURACY_M, VERIFIED_MAX_DISTANCE_M, VISIT_CODE_MESSAGES } from '@/utils/visitCode';

const TOO_FAR_MESSAGE = `Chỉ check-in được khi ở trong bán kính ${CHECKIN_RADIUS_M} m.`;
const NO_FIX_MESSAGE = 'Chưa lấy được vị trí của bạn. Bật GPS rồi thử lại.';
const LOW_ACCURACY_MESSAGE = `GPS chưa đủ chính xác để xác minh bằng QR (cần dưới ${VERIFIED_MAX_ACCURACY_M} m). Bật vị trí chính xác rồi thử lại, hoặc bỏ mã QR để check-in thường.`;
const QR_TOO_FAR_MESSAGE = `Để xác minh bằng QR, bạn cần ở trong quán (cách tối đa ${VERIFIED_MAX_DISTANCE_M} m). Bạn vẫn có thể bỏ mã QR để check-in thường.`;
/** Backend answers that mean the scanned code can't be used any more. */
const DEAD_CODE_ERRORS = ['Invalid or expired visit code', 'Visit code does not belong to this place'];

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

/**
 * Screen 6. Sends a fresh position with the answer; the API checks the 250 m radius and 15-minute cooldown.
 * At a place with an owner, scanning the counter QR (about 90 seconds valid) marks the visit as verified.
 */
export default function CheckinScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { status: sessionStatus, user } = useSession();
  const placeQuery = usePlace(id);
  const location = useCurrentLocation();
  const checkin = useCheckin(id);
  const [crowd, setCrowd] = useState<CheckinCrowd>();
  const [noise, setNoise] = useState<CheckinNoise>();
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<{ message: string; blocking: boolean; at: LatLng | null } | null>(null);
  const [result, setResult] = useState<CheckinResponse | null>(null);
  const [visitCode, setVisitCode] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const place = placeQuery.data?.place;
  const isOwner = Boolean(place?.owner && user?.id && place.owner === user.id);
  const canVerify = Boolean(place?.owner) && !isOwner;

  const handleScan = (data: string): boolean => {
    if (!id) return false;
    const check = checkVisitCode(data, id);
    if (!check.ok) {
      setScanError(VISIT_CODE_MESSAGES[check.reason]);
      return false;
    }
    setScanError(null);
    setError(null);
    setVisitCode(check.code);
    setScanning(false);
    return true;
  };

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
  } else if (isOwner) {
    body = (
      <MessageState
        heading="Bạn đang quản lý địa điểm này"
        sentence="Chủ quán không check-in tại quán của mình. Trạng thái do khách đến học báo lại."
        action={{ label: 'Về địa điểm', onPress: () => router.back() }}
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
        {result.checkin?.verificationLevel === 'qr_verified' ? (
          <Text style={styles.verifiedLine}>
            Đã xác minh lượt ghé bằng mã QR. Đánh giá bạn viết cho quán trong 14 ngày tới sẽ có nhãn đã xác minh.
          </Text>
        ) : null}
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

  if (scanning) {
    return (
      <Screen>
        <Header title="Quét mã QR" back onBack={() => setScanning(false)} />
        <QrScanner
          onScan={handleScan}
          error={scanError}
          hint="Hướng camera vào mã QR StudySpot quán hiển thị tại quầy. Mã chỉ có hiệu lực khoảng 90 giây."
        />
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
    let verification: { visitCode: string; accuracyMeters: number } | null = null;
    if (visitCode) {
      // Check the backend's QR rules first so a weak GPS fix doesn't waste the short-lived code.
      const accuracy = current.accuracyMeters;
      const away = target ? distanceMeters(current.coords, target) : Infinity;
      if (accuracy === null || accuracy > VERIFIED_MAX_ACCURACY_M) {
        setError({ message: LOW_ACCURACY_MESSAGE, blocking: false, at: location.coords });
        return;
      }
      if (away > VERIFIED_MAX_DISTANCE_M) {
        setError({ message: QR_TOO_FAR_MESSAGE, blocking: false, at: location.coords });
        return;
      }
      verification = { visitCode, accuracyMeters: accuracy };
    }
    checkin.mutate(
      { crowd, noise, coordinates: [current.coords.longitude, current.coords.latitude], ...(verification ?? {}) },
      {
        onSuccess: setResult,
        onError: (failure) => {
          if (isApiError(failure) && failure.status === 403 && DEAD_CODE_ERRORS.includes(failure.serverMessage ?? '')) {
            // The code expired or is for another place: ask for a new scan, not a new position.
            setVisitCode(null);
            setError({ message: errorMessage(failure), blocking: false, at: location.coords });
            return;
          }
          const status = errorStatus(failure);
          // The QR accuracy rule depends on the GPS fix, so it doesn't block a retry.
          const qrRule = isApiError(failure) && Boolean(failure.serverMessage?.startsWith('Verified visit requires'));
          setError({
            message: errorMessage(failure),
            blocking: !qrRule && (status === 403 || status === 429),
            at: location.coords,
          });
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

        {canVerify ? (
          <View style={styles.verify}>
            <Text style={styles.groupTitle}>Xác minh lượt ghé (không bắt buộc)</Text>
            {visitCode ? (
              <>
                <Text style={styles.verifiedLine}>
                  Đã quét mã QR của quán. Hãy gửi check-in ngay vì mã chỉ dùng được khoảng 90 giây.
                </Text>
                <View style={styles.inlineActions}>
                  <Pressable accessibilityRole="button" onPress={() => setScanning(true)} style={styles.inlineButton}>
                    <Text style={styles.retryText}>Quét lại</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" onPress={() => setVisitCode(null)} style={styles.inlineButton}>
                    <Text style={styles.removeText}>Bỏ mã QR</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <Text style={type.secondary}>
                  Quét mã QR quán hiển thị tại quầy để check-in và đánh giá của bạn được đánh dấu đã xác minh.
                </Text>
                <Button
                  label="Quét mã QR tại quầy"
                  variant="secondary"
                  size="medium"
                  onPress={() => {
                    setScanError(null);
                    setScanning(true);
                  }}
                />
              </>
            )}
          </View>
        ) : null}

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
  removeText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.textSecondary },
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
  verify: { gap: spacing.sm, paddingTop: spacing.lg, borderTopWidth: sizes.rowRule, borderTopColor: colors.rule },
  verifiedLine: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: colors.ink },
  inlineActions: { flexDirection: 'row', gap: spacing.xl },
  inlineButton: { minHeight: sizes.touchTarget, justifyContent: 'center' },
  alert: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: colors.error },
  success: { gap: spacing.xl, paddingTop: spacing.xxxl, paddingLeft: spacing.contentLeft, paddingRight: spacing.contentRight },
  successText: { gap: spacing.sm },
  successButton: { marginTop: spacing.xs },
});
