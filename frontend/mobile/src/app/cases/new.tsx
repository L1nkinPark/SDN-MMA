import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { casesApi, type SupportCase } from '@/api/cases';
import { errorMessage } from '@/api/errors';
import { useSession } from '@/auth/session';
import { ActionBar, Button, FormAlert, FormScroll, Header, MessageState, Screen, TextArea } from '@/components';
import { type } from '@/theme';

export default function NewCaseScreen() {
  const params = useLocalSearchParams<{ kind: string; targetId: string }>();
  const { status } = useSession();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const kind = params.kind === 'review_appeal' || params.kind === 'booking_dispute' ? params.kind as SupportCase['kind'] : null;
  const create = useMutation({ mutationFn: () => casesApi.create(kind as SupportCase['kind'], params.targetId, reason.trim()),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['cases', 'me'] }); router.replace('/cases'); } });

  if (status === 'guest') return <Screen><Header title="Gửi khiếu nại" back /><MessageState heading="Cần đăng nhập" sentence="Đăng nhập để gửi khiếu nại." action={{ label: 'Đăng nhập', onPress: () => router.push('/login') }} /></Screen>;
  if (!kind || !params.targetId) return <Screen><Header title="Gửi khiếu nại" back /><MessageState heading="Thiếu thông tin" sentence="Hãy mở lại từ booking hoặc đánh giá của bạn." /></Screen>;

  return (
    <Screen>
      <Header title={kind === 'review_appeal' ? 'Khiếu nại đánh giá' : 'Khiếu nại không đến'} back />
      <FormScroll>
        <Text style={type.body}>{kind === 'review_appeal'
          ? 'Giải thích vì sao đánh giá của bạn nên được khôi phục. Gửi trong 14 ngày từ khi bị ẩn.'
          : 'Nêu bằng chứng bạn đã đến quán. Gửi trong 7 ngày từ khi booking bị ghi nhận không đến.'}</Text>
        <TextArea label="Lý do và bằng chứng" value={reason} onChangeText={setReason} rows={6} maxLength={2000}
          placeholder="Ví dụ: thời gian đến, biên lai, nhân viên xác nhận..." />
      </FormScroll>
      <ActionBar>
        <FormAlert message={create.isError ? errorMessage(create.error) : null} />
        <Button label="Gửi khiếu nại" busy={create.isPending} disabled={reason.trim().length < 20}
          onPress={() => create.mutate()} block size="large" />
      </ActionBar>
    </Screen>
  );
}
