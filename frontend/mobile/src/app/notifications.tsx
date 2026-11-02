import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '@/api/client';
import { errorMessage } from '@/api/errors';
import { Button, FormAlert, Header, LoadingList, Screen } from '@/components';
import { spacing, type } from '@/theme';

type Notification = { _id: string; title: string; body: string; createdAt: string; readAt?: string | null };
export default function NotificationsScreen() {
  const client = useQueryClient();
  const list = useQuery({ queryKey: ['notifications'], queryFn: () => api.request<{ items: Notification[]; unreadCount: number }>('/api/notifications', { query: { page: 1, limit: 100 } }) });
  const read = useMutation({ mutationFn: (id: string) => api.request(`/api/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['notifications'] }) });
  const all = useMutation({ mutationFn: () => api.request('/api/notifications/read-all', { method: 'POST' }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['notifications'] }) });
  return <Screen><Header title="Thông báo" back /><ScrollView contentContainerStyle={styles.content}>
    {list.data?.unreadCount ? <Button label={`Đánh dấu đã đọc (${list.data.unreadCount})`} variant="secondary" busy={all.isPending} onPress={() => all.mutate()} /> : null}
    {list.isPending ? <LoadingList rows={3} /> : list.isError ? <FormAlert message={errorMessage(list.error)} /> : list.data?.items.length ?
      list.data.items.map(item => <View key={item._id} style={styles.row}>
        <Text style={type.rowTitle}>{item.readAt ? '' : '● '}{item.title}</Text>
        <Text style={type.body}>{item.body}</Text>
        <Text style={type.secondary}>{new Date(item.createdAt).toLocaleString('vi-VN')}</Text>
        {!item.readAt ? <Button label="Đã đọc" variant="secondary" onPress={() => read.mutate(item._id)} /> : null}
      </View>) : <Text style={type.secondary}>Chưa có thông báo.</Text>}
    <FormAlert message={read.isError ? errorMessage(read.error) : all.isError ? errorMessage(all.error) : null} />
  </ScrollView></Screen>;
}
const styles = StyleSheet.create({ content: { padding: spacing.lg, gap: spacing.md }, row: { paddingVertical: spacing.md, gap: spacing.sm, borderBottomWidth: 1 } });
