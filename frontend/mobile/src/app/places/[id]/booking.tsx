import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { MAX_PARTY_SIZE, MAX_UPCOMING_BOOKINGS, NOTE_MAX_LENGTH } from '@/api/bookings';
import { errorMessage } from '@/api/errors';
import { useAvailability, useCreateBooking } from '@/api/hooks/useBookings';
import { usePlace } from '@/api/hooks/usePlace';
import type { Availability, CreateBookingResponse, Place } from '@/api/types';
import { useSession } from '@/auth/session';
import {
  ActionBar,
  Button,
  ChoiceChip,
  FormAlert,
  Header,
  LoadingList,
  MessageState,
  Screen,
  TextArea,
} from '@/components';
import { colors, fonts, sizes, spacing, type } from '@/theme';
import {
  isBookableStart,
  longDateLabel,
  nextDateKeys,
  shortDateLabel,
  slotStartTimes,
  vnDateTime,
  vnInstant,
  weekdayOf,
} from '@/utils/vnTime';

/** Today plus the 14 days the backend allows. */
const DAYS_SHOWN = 15;

type Slot = { clock: string; remaining: number; available: boolean };

/** Every start time of the day with the seats left, from opening hours and the slots already booked. */
function daySlots(availability: Availability, date: string, partySize: number, now: number): Slot[] {
  const hours = availability.openingHours.find((item) => item.day === weekdayOf(date));
  if (!hours?.open || !hours.close) return [];
  const capacity = availability.capacityPerSlot ?? 0;
  return slotStartTimes(hours.open, hours.close, availability.slotMinutes).map((clock) => {
    const start = vnInstant(date, clock);
    const booked = availability.slots.find((slot) => Date.parse(slot.startsAt) === start.getTime());
    const remaining = Math.max(0, (booked?.capacity ?? capacity) - (booked?.reserved ?? 0));
    return { clock, remaining, available: isBookableStart(start, now) && remaining >= partySize };
  });
}

/** Days the shop is closed for sure, from the place itself, so the chips can say so before loading. */
function closedDay(place: Place, date: string): boolean {
  const business = place.business;
  if (business?.closedDates?.includes(date)) return true;
  const hours = business?.openingHours ?? [];
  return hours.length > 0 && !hours.some((item) => item.day === weekdayOf(date));
}

function PartySize({ value, max, onChange }: { value: number; max: number; onChange: (value: number) => void }) {
  return (
    <View style={styles.stepper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Bớt một người"
        accessibilityState={{ disabled: value <= 1 }}
        disabled={value <= 1}
        onPress={() => onChange(value - 1)}
        style={[styles.stepButton, value <= 1 ? styles.stepDisabled : null]}>
        <Text style={styles.stepText}>−</Text>
      </Pressable>
      <Text accessibilityLiveRegion="polite" style={styles.stepValue}>
        {value} người
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Thêm một người"
        accessibilityState={{ disabled: value >= max }}
        disabled={value >= max}
        onPress={() => onChange(value + 1)}
        style={[styles.stepButton, value >= max ? styles.stepDisabled : null]}>
        <Text style={styles.stepText}>+</Text>
      </Pressable>
    </View>
  );
}

function Success({ result, placeName }: { result: CreateBookingResponse; placeName: string }) {
  const booking = result.booking;
  const pending = booking.status === 'pending';
  const heading = result.alreadyExists ? 'Bạn đã đặt khung giờ này' : pending ? 'Đã gửi yêu cầu đặt chỗ' : 'Đã đặt chỗ';
  const sentence = result.alreadyExists
    ? 'Lượt đặt trước đó vẫn còn hiệu lực; không có lượt mới nào được tạo.'
    : pending
      ? `Quán cần xác nhận trước ${vnDateTime(booking.holdUntil)}. Nếu quá hạn, yêu cầu tự hủy và chỗ được trả lại.`
      : 'Quán đã giữ chỗ cho bạn. Bạn có thể hủy trước giờ đến ít nhất 1 giờ.';
  return (
    <View style={styles.success}>
      <Text accessibilityRole="header" style={type.heading}>
        {heading}
      </Text>
      <Text style={styles.successPlace}>{placeName}</Text>
      <Text style={type.body}>
        {vnDateTime(booking.startsAt)} · {booking.partySize ?? 1} người
      </Text>
      <Text style={type.body}>{sentence}</Text>
      <Button label="Xem đặt chỗ của tôi" variant="primary" onPress={() => router.replace('/my-bookings')} />
      <Button label="Về địa điểm" variant="secondary" onPress={() => router.back()} />
    </View>
  );
}

/** Đặt chỗ: pick a Vietnam-time day and slot, the party size and a note. */
export default function BookingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { status, user } = useSession();
  const placeQuery = usePlace(id);
  const dates = useMemo(() => nextDateKeys(DAYS_SHOWN), []);
  const [date, setDate] = useState(dates[0]);
  const [clock, setClock] = useState<string | null>(null);
  const [partySize, setPartySize] = useState(1);
  const [note, setNote] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const availability = useAvailability(id, date);
  const create = useCreateBooking(id ?? '');
  const retry = useRef<{ fingerprint: string; key: string } | null>(null);

  // Slots close one hour before they start; keep the list honest while the screen stays open.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const place = placeQuery.data?.place;
  const isOwner = Boolean(place?.owner && user?.id && place.owner === user.id);

  let body;
  if (status === 'guest') {
    body = (
      <MessageState
        heading="Đăng nhập để đặt chỗ"
        sentence="Lượt đặt chỗ được giữ theo tài khoản của bạn."
        action={{ label: 'Đăng nhập', variant: 'primary', onPress: () => router.push('/login') }}
      />
    );
  } else if (placeQuery.isPending) {
    body = <LoadingList rows={3} />;
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
        sentence="Chủ quán không đặt chỗ tại quán của mình."
        action={{ label: 'Về địa điểm', onPress: () => router.back() }}
      />
    );
  } else if (place.business?.temporaryClosed) {
    body = (
      <MessageState
        heading="Quán đang tạm đóng cửa"
        sentence="Quán tạm ngừng nhận khách nên chưa đặt chỗ được. Hãy quay lại sau."
        action={{ label: 'Về địa điểm', onPress: () => router.back() }}
      />
    );
  } else if (!place.booking?.enabled) {
    body = (
      <MessageState
        heading="Quán chưa nhận đặt chỗ"
        sentence="Bạn vẫn có thể đến trực tiếp và check-in để báo độ đông, độ ồn."
        action={{ label: 'Về địa điểm', onPress: () => router.back() }}
      />
    );
  } else if (create.data) {
    body = <Success result={create.data} placeName={place.name ?? 'Địa điểm'} />;
  }

  if (body || !place) {
    return (
      <Screen>
        <Header title="Đặt chỗ" back />
        {body}
      </Screen>
    );
  }

  const data = availability.data;
  const capacity = data?.capacityPerSlot ?? place.booking?.capacityPerSlot ?? MAX_PARTY_SIZE;
  const maxParty = Math.max(1, Math.min(MAX_PARTY_SIZE, capacity));
  // The seat limit is only known once availability loads; never send more than it allows.
  const party = Math.min(partySize, maxParty);
  const slots = data ? daySlots(data, date, party, now) : [];
  const selected = slots.find((slot) => slot.clock === clock);
  const canSubmit = Boolean(data?.enabled && selected?.available) && !create.isPending;

  function chooseDate(next: string) {
    setDate(next);
    setClock(null);
    if (create.isError) create.reset();
  }

  function submit() {
    if (!id || !clock || !canSubmit) return;
    const input = {
      placeId: id,
      startsAt: vnInstant(date, clock).toISOString(),
      partySize: party,
      ...(note.trim() ? { note: note.trim() } : {}),
    };
    const fingerprint = JSON.stringify(input);
    if (retry.current?.fingerprint !== fingerprint) {
      retry.current = { fingerprint, key: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}` };
    }
    create.mutate({ ...input, idempotencyKey: retry.current.key });
  }

  let slotArea;
  if (availability.isPending) {
    slotArea = <LoadingList rows={2} />;
  } else if (availability.isError || !data) {
    slotArea = (
      <View style={styles.slotState}>
        <FormAlert message={errorMessage(availability.error)} />
        <Button label="Thử lại" variant="secondary" size="medium" busy={availability.isFetching} onPress={() => availability.refetch()} />
      </View>
    );
  } else if (data.closedOnDate) {
    slotArea = <Text style={styles.closed}>Quán nghỉ vào ngày này. Hãy chọn ngày khác.</Text>;
  } else if (!data.enabled) {
    slotArea = <Text style={styles.closed}>Quán không nhận đặt chỗ vào ngày này.</Text>;
  } else if (slots.length === 0) {
    slotArea = <Text style={styles.closed}>Quán không mở cửa hoặc không còn khung giờ nào vào ngày này.</Text>;
  } else {
    slotArea = (
      <>
        <View style={styles.chips}>
          {slots.map((slot) => (
            <ChoiceChip
              key={slot.clock}
              label={slot.remaining > 0 ? `${slot.clock} · còn ${slot.remaining}` : `${slot.clock} · hết chỗ`}
              accessibilityLabel={`${slot.clock}, còn ${slot.remaining} chỗ`}
              selected={clock === slot.clock}
              disabled={!slot.available}
              onPress={() => {
                setClock(slot.clock);
                if (create.isError) create.reset();
              }}
            />
          ))}
        </View>
        {slots.every((slot) => !slot.available) ? (
          <Text style={styles.closed}>Không còn khung giờ đặt được cho {party} người vào ngày này.</Text>
        ) : (
          <Text style={type.secondary}>Mỗi khung dài {data.slotMinutes} phút. Giờ đã qua hoặc còn dưới 1 giờ không đặt được.</Text>
        )}
      </>
    );
  }

  return (
    <Screen>
      <Header title="Đặt chỗ" back />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.intro}>
          <Text style={styles.placeName}>{place.name}</Text>
          {place.address ? <Text style={type.secondary}>{place.address}</Text> : null}
          <Text style={type.secondary}>
            Đặt trước ít nhất 1 giờ, tối đa 14 ngày. Mỗi tài khoản giữ tối đa {MAX_UPCOMING_BOOKINGS} lượt sắp tới.
            {place.booking?.approvalMode === 'manual' ? ' Quán xác nhận từng lượt đặt.' : ''}
          </Text>
        </View>

        <View style={styles.group}>
          <Text style={styles.groupTitle}>Ngày đến</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dates}>
            {dates.map((key) => (
              <ChoiceChip
                key={key}
                label={closedDay(place, key) ? `${shortDateLabel(key)} · nghỉ` : shortDateLabel(key)}
                accessibilityLabel={longDateLabel(key)}
                selected={key === date}
                onPress={() => chooseDate(key)}
              />
            ))}
          </ScrollView>
          <Text style={type.secondary}>{longDateLabel(date)} (giờ Việt Nam)</Text>
        </View>

        <View style={styles.group}>
          <Text style={styles.groupTitle}>Số người</Text>
          <PartySize
            value={party}
            max={maxParty}
            onChange={(value) => {
              setPartySize(value);
              if (create.isError) create.reset();
            }}
          />
          <Text style={type.secondary}>Tối đa {maxParty} người cho một lượt đặt.</Text>
        </View>

        <View style={styles.group}>
          <Text style={styles.groupTitle}>Giờ đến</Text>
          {slotArea}
        </View>

        <TextArea
          label="Ghi chú cho quán (không bắt buộc)"
          value={note}
          onChangeText={setNote}
          placeholder="Ví dụ: cần bàn gần ổ cắm"
          maxLength={NOTE_MAX_LENGTH}
          rows={3}
          showCount
        />
      </ScrollView>

      <ActionBar>
        <FormAlert message={create.isError ? errorMessage(create.error) : null} />
        <Button
          label={place.booking?.approvalMode === 'manual' ? 'Gửi yêu cầu đặt chỗ' : 'Đặt chỗ'}
          busyLabel="Đang gửi"
          busy={create.isPending}
          disabled={!canSubmit}
          onPress={submit}
          block
          size="large"
        />
        {selected ? (
          <Text style={type.secondary}>
            {longDateLabel(date)} · {selected.clock} · {party} người
          </Text>
        ) : (
          <Text style={type.secondary}>Chọn giờ đến để đặt chỗ.</Text>
        )}
      </ActionBar>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.xxl, paddingTop: spacing.xl, paddingBottom: spacing.xl, paddingLeft: spacing.contentLeft, paddingRight: spacing.contentRight },
  intro: { gap: spacing.xs },
  placeName: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22, color: colors.text },
  group: { gap: 10 },
  groupTitle: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22, color: colors.text },
  dates: { gap: spacing.sm, paddingRight: spacing.contentRight },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  slotState: { gap: spacing.sm, alignItems: 'flex-start' },
  closed: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: colors.error },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  stepButton: {
    width: sizes.touchTarget,
    height: sizes.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: sizes.radius,
  },
  stepDisabled: { borderColor: colors.fieldLine, opacity: 0.5 },
  stepText: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 24, color: colors.ink },
  stepValue: { minWidth: 72, textAlign: 'center', fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  success: { gap: spacing.md, paddingTop: spacing.xxxl, paddingLeft: spacing.contentLeft, paddingRight: spacing.contentRight },
  successPlace: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22, color: colors.text },
});
