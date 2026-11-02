import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '@/api/client';
import { errorMessage } from '@/api/errors';
import { Button, FormAlert, Header, LoadingList, Screen } from '@/components';
import { spacing, type } from '@/theme';

type Booking = { _id: string; startsAt: string; partySize: number; status: string; note?: string;
  cancellationReason?: string;
  place?: { _id: string; name: string; address: string } };
export default function MyBookingsScreen() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(timer); }, []);
  const client = useQueryClient();
  const list = useQuery({ queryKey: ['my-bookings'], queryFn: () => api.request<{ items: Booking[] }>('/api/bookings/me', { query: { page: 1, limit: 100 } }) });
  const cancel = useMutation({ mutationFn: (id: string) => api.request(`/api/bookings/${encodeURIComponent(id)}/cancel`, { method: 'POST' }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['my-bookings'] }) });
  return <Screen><Header title="Đặt chỗ của tôi" back /><ScrollView contentContainerStyle={styles.content}>
    {list.isPending ? <LoadingList rows={3} /> : list.isError ? <FormAlert message={errorMessage(list.error)} /> :
      list.data?.items.length ? list.data.items.map(item => <View key={item._id} style={styles.row}>
        <Text style={type.rowTitle}>{item.place?.name || 'Quán'}</Text>
        <Text style={type.secondary}>{new Date(item.startsAt).toLocaleString('vi-VN')} · {item.partySize} người</Text>
        <Text style={type.secondary}>Trạng thái: {item.status}</Text>
        {item.cancellationReason ? <Text style={type.secondary}>Lý do: {item.cancellationReason}</Text> : null}
        {item.place?._id ? <Button label="Xem quán" variant="secondary" onPress={() => router.push({ pathname: '/places/[id]', params: { id: item.place!._id } })} /> : null}
        {['pending', 'confirmed'].includes(item.status) && new Date(item.startsAt).getTime() > now + 3600000 ?
          <Button label="Hủy đặt chỗ" variant="secondary" busy={cancel.isPending} onPress={() => cancel.mutate(item._id)} /> : null}
      </View>) : <Text style={type.secondary}>Bạn chưa có booking nào.</Text>}
    <FormAlert message={cancel.isError ? errorMessage(cancel.error) : null} />
  </ScrollView></Screen>;
}
const styles = StyleSheet.create({ content: { padding: spacing.lg, gap: spacing.md }, row: { gap: spacing.sm, paddingVertical: spacing.md, borderBottomWidth: 1 } });
