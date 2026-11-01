import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { Pressable, StyleSheet, Text, View, type TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { authApi } from '@/api/auth';
import { errorMessage, isApiError } from '@/api/errors';
import { Button, FormScroll, Screen, TextField } from '@/components';
import { useSession } from '@/auth/session';
import { colors, fonts, spacing, type } from '@/theme';
import { emailError, passwordError } from '@/utils/validation';

type FieldErrors = { email: string | null; password: string | null };

/** Leaves login: back to the screen that asked for it, or Khám phá when there is nothing to go back to. */
function leave() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { signIn } = useSession();
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({ email: null, password: null });

  const login = useMutation({
    mutationFn: authApi.login,
    onSuccess: async (result) => {
      await signIn(result);
      leave();
    },
  });

  const wrongCredentials = isApiError(login.error) && login.error.status === 401;

  function submit() {
    if (login.isPending) return;
    const errors = { email: emailError(email), password: passwordError(password) };
    setFieldErrors(errors);
    if (errors.email || errors.password) return;
    login.mutate({ email, password });
  }

  function edit(setter: (value: string) => void, field: keyof FieldErrors) {
    return (value: string) => {
      setter(value);
      if (fieldErrors[field]) setFieldErrors((current) => ({ ...current, [field]: null }));
      if (login.isError) login.reset();
    };
  }

  return (
    <Screen>
      <FormScroll
        contentStyle={{
          paddingTop: Math.max(insets.top, 24) + 16,
          paddingBottom: Math.max(insets.bottom, 16) + 24,
          paddingLeft: spacing.contentLeft,
          paddingRight: spacing.contentRight,
        }}>
        <View style={styles.topRow}>
          <Text style={styles.brand}>StudySpot</Text>
          <Pressable accessibilityRole="button" onPress={leave} style={styles.later}>
            <Text style={styles.laterText}>Để sau</Text>
          </Pressable>
        </View>

        <View style={styles.intro}>
          <Text accessibilityRole="header" style={type.loginTitle}>
            {'Hôm nay\nhọc ở đâu?'}
          </Text>
          <Text style={type.body}>Xem chỗ nào vắng và yên tĩnh trước khi đến.</Text>
        </View>

        <View style={styles.form}>
          <TextField
            label="Email"
            value={email}
            onChangeText={edit(setEmail, 'email')}
            placeholder="ten@fpt.edu.vn"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            error={fieldErrors.email}
            invalid={wrongCredentials}
            editable={!login.isPending}
          />
          <TextField
            ref={passwordRef}
            label="Mật khẩu"
            value={password}
            onChangeText={edit(setPassword, 'password')}
            placeholder="Ít nhất 8 ký tự"
            password
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={submit}
            error={fieldErrors.password}
            invalid={wrongCredentials}
            editable={!login.isPending}
          />
          {login.isError ? (
            <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.alert}>
              {errorMessage(login.error)}
            </Text>
          ) : null}
          <Button label="Đăng nhập" busyLabel="Đang đăng nhập" busy={login.isPending} onPress={submit} block size="large" />
          <View style={styles.registerRow}>
            <Text style={styles.registerText}>Chưa có tài khoản?</Text>
            <Pressable accessibilityRole="link" onPress={() => router.replace('/register')} style={styles.registerLink}>
              <Text style={styles.registerLinkText}>Đăng ký</Text>
            </Pressable>
          </View>
        </View>
      </FormScroll>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { fontFamily: fonts.title, fontSize: 24, lineHeight: 24, color: colors.ink },
  later: { minHeight: 44, paddingLeft: spacing.lg, justifyContent: 'center' },
  laterText: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  intro: { gap: spacing.xl, marginTop: 72 },
  form: { gap: 18, marginTop: 'auto', paddingTop: spacing.xxxl },
  alert: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: colors.error },
  registerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  registerText: { fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary },
  registerLink: { minHeight: 44, justifyContent: 'center' },
  registerLinkText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
});
