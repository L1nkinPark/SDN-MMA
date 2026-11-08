import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { casesApi } from '@/api/cases';
import { errorMessage } from '@/api/errors';
import { useSession } from '@/auth/session';
import { Header, LoadingList, MessageState, Screen } from '@/components';
import { type } from '@/theme';
import { formatDate } from '@/utils/format';

export default function MyCasesScreen() {
  const { status } = useSession();
  const cases = useQuery({ queryKey: ['cases', 'me'], queryFn: casesApi.mine, enabled: status === 'signed-in' });
  if (status === 'guest') return <Screen><Header title="Khiếu nại của tôi" back /><MessageState heading="Cần đăng nhập" sentence="Đăng nhập để xem khiếu nại." action={{ label: 'Đăng nhập', onPress: () => router.push('/login') }} /></Screen>;
  return <Screen><Header title="Khiếu nại của tôi" back />
    {cases.isPending ? <LoadingList /> : cases.isError ? <MessageState tone="error" heading="Chưa tải được khiếu nại" sentence={errorMessage(cases.error)} action={{ label: 'Thử lại', onPress: () => cases.refetch() }} /> :
      cases.data.items.length === 0 ? <MessageState heading="Chưa có khiếu nại" sentence="Bạn có thể gửi khiếu nại từ đánh giá bị ẩn hoặc booking ghi nhận không đến." /> :
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
          {cases.data.items.map((item) => <View key={item._id} style={{ gap: 5 }}>
            <Text style={type.heading}>{item.kind === 'review_appeal' ? 'Đánh giá bị ẩn' : 'Booking không đến'} · {item.status === 'pending' ? 'Chờ xử lý' : item.status === 'accepted' ? 'Đã chấp nhận' : 'Đã từ chối'}</Text>
            <Text style={type.secondary}>{formatDate(item.createdAt)}</Text>
            <Text style={type.body}>{item.reason}</Text>
            {item.decisionNote ? <Text style={type.secondary}>Phản hồi: {item.decisionNote}</Text> : null}
          </View>)}
        </ScrollView>}
  </Screen>;
}
