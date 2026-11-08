import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { errorMessage, isApiError } from '@/api/errors';
import { useChangePassword } from '@/api/hooks/useAccount';
import { useSession } from '@/auth/session';
import { ActionBar, Button, FormAlert, FormScroll, Header, MessageState, Screen, TextField } from '@/components';
import { spacing, type } from '@/theme';
import { confirmPasswordError, passwordError } from '@/utils/validation';

type Field = 'current' | 'next' | 'confirm';
type Errors = Record<Field, string | null>;
const NO_ERRORS: Errors = { current: null, next: null, confirm: null };

/** The backend revokes every session after a change, so the user signs in again with the new password. */
export default function ChangePasswordScreen() {
  const { status } = useSession();
  const change = useChangePassword();
  const [values, setValues] = useState<Record<Field, string>>({ current: '', next: '', confirm: '' });
  const [errors, setErrors] = useState<Errors>(NO_ERRORS);

  if (change.isSuccess) {
    return (
      <Screen>
        <Header title="Đổi mật khẩu" back onBack={() => router.replace('/')} />
        <MessageState
          heading="Đã đổi mật khẩu"
          sentence="Bạn đã được đăng xuất trên mọi thiết bị. Hãy đăng nhập lại bằng mật khẩu mới."
          action={{ label: 'Đăng nhập', variant: 'primary', onPress: () => router.replace('/login') }}
        />
      </Screen>
    );
  }

  if (status === 'guest') {
    return (
      <Screen>
        <Header title="Đổi mật khẩu" back />
        <MessageState
          heading="Đăng nhập để đổi mật khẩu"
          sentence="Nếu quên mật khẩu, hãy dùng Quên mật khẩu ở màn đăng nhập."
          action={{ label: 'Đăng nhập', variant: 'primary', onPress: () => router.push('/login') }}
        />
      </Screen>
    );
  }

  // 403 means the current password is wrong; show it under that field.
  const wrongCurrent = isApiError(change.error) && change.error.status === 403;

  function edit(field: Field) {
    return (value: string) => {
      setValues((current) => ({ ...current, [field]: value }));
      if (errors[field]) setErrors((current) => ({ ...current, [field]: null }));
      if (change.isError) change.reset();
    };
  }

  function submit() {
    if (change.isPending) return;
    const found: Errors = {
      current: passwordError(values.current),
      next:
        passwordError(values.next) ??
        (values.next === values.current ? 'Mật khẩu mới phải khác mật khẩu hiện tại.' : null),
      confirm: confirmPasswordError(values.next, values.confirm),
    };
    setErrors(found);
    if (found.current || found.next || found.confirm) return;
    change.mutate({ currentPassword: values.current, newPassword: values.next });
  }

  return (
    <Screen>
      <Header title="Đổi mật khẩu" back />
      <FormScroll contentStyle={styles.body}>
        <Text style={type.body}>Sau khi đổi, bạn sẽ được đăng xuất trên mọi thiết bị.</Text>
        <TextField
          label="Mật khẩu hiện tại"
          value={values.current}
          onChangeText={edit('current')}
          password
          autoComplete="current-password"
          textContentType="password"
          error={errors.current ?? (wrongCurrent ? errorMessage(change.error) : null)}
          editable={!change.isPending}
        />
        <TextField
          label="Mật khẩu mới"
          value={values.next}
          onChangeText={edit('next')}
          placeholder="Ít nhất 8 ký tự"
          password
          autoComplete="new-password"
          textContentType="newPassword"
          error={errors.next}
          editable={!change.isPending}
          maxLength={128}
        />
        <TextField
          label="Nhập lại mật khẩu mới"
          value={values.confirm}
          onChangeText={edit('confirm')}
          password
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={submit}
          error={errors.confirm}
          editable={!change.isPending}
          maxLength={128}
        />
      </FormScroll>
      <ActionBar>
        <FormAlert message={change.isError && !wrongCurrent ? errorMessage(change.error) : null} />
        <Button label="Đổi mật khẩu" busyLabel="Đang lưu" busy={change.isPending} onPress={submit} block size="large" />
      </ActionBar>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.xl, paddingVertical: spacing.xl, paddingLeft: spacing.contentLeft, paddingRight: spacing.contentRight },
});
