import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { errorMessage, isApiError } from '@/api/errors';
import { useDeleteAccount } from '@/api/hooks/useAccount';
import { useSession } from '@/auth/session';
import { ActionBar, Button, FormAlert, FormScroll, Header, MessageState, Screen, TextField } from '@/components';
import { colors, fonts, spacing, type } from '@/theme';
import { passwordError } from '@/utils/validation';

const WHAT_IS_DELETED = [
  'Đánh giá, check-in, báo cáo và lượt đặt chỗ của bạn.',
  'Lượt đặt chỗ sắp tới được hủy và trả chỗ cho quán.',
  'Quyền quản lý quán (nếu có) được gỡ khỏi tài khoản.',
  'Tên và email bị thay thế; tài khoản không đăng nhập lại được.',
];

/** `DELETE /api/auth/me` with the password. Admin accounts cannot delete themselves. */
export default function DeleteAccountScreen() {
  const { status, user } = useSession();
  const remove = useDeleteAccount();
  const [password, setPassword] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);

  if (remove.isSuccess) {
    return (
      <Screen>
        <Header title="Xóa tài khoản" back onBack={() => router.replace('/')} />
        <MessageState
          heading="Đã xóa tài khoản"
          sentence="Dữ liệu cá nhân của bạn đã được xóa. Bạn vẫn xem được địa điểm mà không cần tài khoản."
          action={{ label: 'Về Khám phá', onPress: () => router.replace('/') }}
        />
      </Screen>
    );
  }

  if (status === 'guest') {
    return (
      <Screen>
        <Header title="Xóa tài khoản" back />
        <MessageState
          heading="Đăng nhập để xóa tài khoản"
          sentence="Bạn cần xác nhận bằng mật khẩu của tài khoản."
          action={{ label: 'Đăng nhập', variant: 'primary', onPress: () => router.push('/login') }}
        />
      </Screen>
    );
  }

  if (user?.role === 'admin') {
    return (
      <Screen>
        <Header title="Xóa tài khoản" back />
        <MessageState heading="Không tự xóa được" sentence="Tài khoản quản trị không tự xóa được. Hãy nhờ một quản trị viên khác." />
      </Screen>
    );
  }

  const wrongPassword = isApiError(remove.error) && remove.error.status === 403;

  function confirm() {
    if (remove.isPending) return;
    const error = passwordError(password);
    setFieldError(error);
    if (error) return;
    Alert.alert('Xóa tài khoản?', 'Dữ liệu cá nhân sẽ bị xóa và không khôi phục được.', [
      { text: 'Giữ tài khoản', style: 'cancel' },
      { text: 'Xóa', style: 'destructive', onPress: () => remove.mutate({ password }) },
    ]);
  }

  return (
    <Screen>
      <Header title="Xóa tài khoản" back />
      <FormScroll contentStyle={styles.body}>
        <View style={styles.list}>
          <Text style={type.body}>Khi xóa tài khoản:</Text>
          {WHAT_IS_DELETED.map((line) => (
            <Text key={line} style={styles.item}>
              – {line}
            </Text>
          ))}
        </View>
        <TextField
          label="Mật khẩu để xác nhận"
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            if (fieldError) setFieldError(null);
            if (remove.isError) remove.reset();
          }}
          password
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={confirm}
          error={fieldError ?? (wrongPassword ? errorMessage(remove.error) : null)}
          editable={!remove.isPending}
        />
      </FormScroll>
      <ActionBar>
        <FormAlert message={remove.isError && !wrongPassword ? errorMessage(remove.error) : null} />
        <Button label="Xóa tài khoản" busyLabel="Đang xóa" busy={remove.isPending} onPress={confirm} block size="large" />
      </ActionBar>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.xl, paddingVertical: spacing.xl, paddingLeft: spacing.contentLeft, paddingRight: spacing.contentRight },
  list: { gap: spacing.sm },
  item: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.text },
});
