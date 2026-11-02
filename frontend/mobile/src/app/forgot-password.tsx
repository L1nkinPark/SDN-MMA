import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api } from '@/api/client';
import { errorMessage } from '@/api/errors';
import { Button, FormAlert, FormScroll, Header, Screen, TextField } from '@/components';
import { spacing, type } from '@/theme';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [sent, setSent] = useState(false);
  const forgot = useMutation({ mutationFn: () => api.request('/api/auth/forgot-password', { method: 'POST', body: { email: email.trim().toLowerCase() } }),
    onSuccess: () => setSent(true) });
  const reset = useMutation({ mutationFn: () => api.request('/api/auth/reset-password', { method: 'POST', body: { token: token.trim(), newPassword: password } }),
    onSuccess: () => router.replace('/login') });
  return <Screen><Header title="Đặt lại mật khẩu" back /><FormScroll contentStyle={styles.content}>
    <Text style={type.body}>Nhập email để nhận mã đặt lại mật khẩu. Mã có hiệu lực trong 30 phút.</Text>
    <TextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
    <Button label="Gửi mã qua email" disabled={!email.includes('@')} busy={forgot.isPending} onPress={() => forgot.mutate()} />
    {sent ? <View style={styles.form}>
      <Text style={type.secondary}>Nếu tài khoản tồn tại, mã đã được gửi. Kiểm tra hộp thư và thư rác.</Text>
      <TextField label="Mã trong email" value={token} onChangeText={setToken} autoCapitalize="none" />
      <TextField label="Mật khẩu mới" password value={password} onChangeText={setPassword} />
      <Button label="Đặt lại mật khẩu" disabled={token.trim().length < 32 || password.length < 8} busy={reset.isPending} onPress={() => reset.mutate()} />
    </View> : null}
    <FormAlert message={forgot.isError ? errorMessage(forgot.error) : reset.isError ? errorMessage(reset.error) : null} />
  </FormScroll></Screen>;
}
const styles = StyleSheet.create({ content: { padding: spacing.lg, gap: spacing.lg }, form: { gap: spacing.md } });
