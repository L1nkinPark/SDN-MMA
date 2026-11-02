import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '@/api/client';
import { errorMessage } from '@/api/errors';
import { usePlace } from '@/api/hooks/usePlace';
import { Button, ChoiceChip, FormAlert, Header, LoadingList, Screen, TextField } from '@/components';
import { colors, fonts, spacing, type } from '@/theme';

type Slot = { startsAt: string; reserved: number; capacity: number };
type Availability = { enabled: boolean; capacityPerSlot: number | null; slotMinutes: number;
  openingHours: { day: number; open: string; close: string }[]; slots: Slot[] };
function todayVietnam() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
function times(open: string, close: string, duration: number): string[] {
  const [h, m] = open.split(':').map(Number);
  const [ch, cm] = close.split(':').map(Number);
  const result: string[] = [];
  for (let minute = Math.ceil((h * 60 + m) / duration) * duration; minute + duration <= ch * 60 + cm; minute += duration) {
    result.push(`${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`);
  }
  return result;
}
export default function BookingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const client = useQueryClient();
  const place = usePlace(id);
  const [date, setDate] = useState(todayVietnam);
  const [time, setTime] = useState('');
  const [partySize, setPartySize] = useState('1');
  const [note, setNote] = useState('');
  const [success, setSuccess] = useState('');
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(timer); }, []);
  const availability = useQuery({ queryKey: ['availability', id, date], enabled: !!id && /^\d{4}-\d{2}-\d{2}$/.test(date),
    queryFn: () => api.request<Availability>(`/api/places/${encodeURIComponent(id)}/availability`, { query: { date } }) });
  const create = useMutation({ mutationFn: () => api.request<{ booking: { status: string } }>('/api/bookings', {
    method: 'POST', body: { placeId: id, startsAt: new Date(`${date}T${time}:00+07:00`).toISOString(), partySize: Number(partySize), note: note.trim() } }),
    onSuccess: result => { setSuccess(result.booking.status === 'pending' ? 'Đã gửi yêu cầu. Chờ quán xác nhận.' : 'Đặt chỗ thành công.');
      void client.invalidateQueries({ queryKey: ['my-bookings'] }); } });
  const selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T12:00:00+07:00`) : null;
  const day = selectedDate?.getUTCDay();
  const hours = availability.data?.openingHours.find(h => h.day === day);
  const capacity = availability.data?.capacityPerSlot || 0;
  const choices = hours ? times(hours.open, hours.close, availability.data?.slotMinutes || 60) : [];
  const booked = (clock: string) => availability.data?.slots.find(s => s.startsAt === new Date(`${date}T${clock}:00+07:00`).toISOString())?.reserved || 0;
  const validDate = selectedDate && selectedDate.getTime() > now && selectedDate.getTime() < now + 15 * 86400000;
  const selectedStart = time ? new Date(`${date}T${time}:00+07:00`).getTime() : 0;
  const selectedAvailable = !!time && !!availability.data?.enabled && selectedStart >= now + 3600000 &&
    selectedStart <= now + 14 * 86400000 && capacity - booked(time) >= Number(partySize);
  return <Screen><Header title="Đặt chỗ" back /><ScrollView contentContainerStyle={styles.content}>
    {place.isPending ? <LoadingList rows={2} /> : <Text style={type.heading}>{place.data?.place?.name || 'Địa điểm'}</Text>}
    <Text style={type.secondary}>Đặt trước ít nhất 1 giờ, tối đa 14 ngày. Mỗi tài khoản giữ tối đa 3 booking sắp tới.</Text>
    <TextField label="Ngày đến (YYYY-MM-DD)" value={date} onChangeText={value => { setDate(value); setTime(''); }} autoCapitalize="none" />
    <TextField label="Số người (1–20)" value={partySize} onChangeText={setPartySize} keyboardType="number-pad" />
    {availability.isPending ? <LoadingList rows={2} /> : availability.isError ? <FormAlert message={errorMessage(availability.error)} /> :
      !availability.data?.enabled ? <Text style={styles.warning}>Quán chưa bật đặt chỗ.</Text> :
      !hours ? <Text style={styles.warning}>Quán không nhận khách vào ngày này.</Text> : <View style={styles.times}>
        <Text style={type.label}>Chọn giờ đến</Text><View style={styles.chips}>{choices.map(clock => {
          const start = new Date(`${date}T${clock}:00+07:00`).getTime();
          const remaining = capacity - booked(clock);
          const available = start >= now + 3600000 && start <= now + 14 * 86400000 && remaining >= Number(partySize);
          return <ChoiceChip key={clock} label={`${clock} · còn ${remaining}`} selected={time === clock} disabled={!available} onPress={() => setTime(clock)} />;
        })}</View></View>}
    <TextField label="Ghi chú cho quán" value={note} onChangeText={setNote} maxLength={500} />
    <FormAlert message={create.isError ? errorMessage(create.error) : null} />
    {success ? <Text style={styles.success}>{success}</Text> : null}
    <Button label="Xác nhận đặt chỗ" busy={create.isPending} disabled={!validDate || !selectedAvailable || Number(partySize) < 1 || Number(partySize) > 20 || !Number.isInteger(Number(partySize))}
      onPress={() => create.mutate()} block />
    {success ? <Button label="Xem booking của tôi" variant="secondary" onPress={() => router.push('/my-bookings')} block /> : null}
  </ScrollView></Screen>;
}
const styles = StyleSheet.create({ content: { gap: spacing.lg, padding: spacing.lg }, times: { gap: spacing.sm }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, warning: { color: colors.error, fontFamily: fonts.medium }, success: { color: colors.ink, fontFamily: fonts.semibold } });
