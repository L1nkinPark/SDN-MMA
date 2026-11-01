import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { Pressable, StyleSheet, Text, View, type TextInput } from 'react-native';

import { authApi } from '@/api/auth';
import { errorMessage, isApiError } from '@/api/errors';
import { useSession } from '@/auth/session';
import { ActionBar, Button, FormAlert, FormScroll, Header, Screen, TextField } from '@/components';
import { colors, fonts, spacing } from '@/theme';
import { emailError, nameError, passwordError } from '@/utils/validation';

type Field = 'name' | 'email' | 'password';
type FieldErrors = Record<Field, string | null>;

const NO_ERRORS: FieldErrors = { name: null, email: null, password: null };

/** Back to the screen that asked for an account, or Khám phá. */
function leave() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export default function RegisterScreen() {
  const { signIn } = useSession();
  const emailRef = useRef<ComponentRef<typeof TextInput>>(null);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const [values, setValues] = useState<Record<Field, string>>({ name: '', email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>(NO_ERRORS);

  const register = useMutation({
    mutationFn: authApi.register,
    onSuccess: async (result) => {
      await signIn(result);
      leave();
    },
  });

  // 409 belongs under the email field; other failures show above the button.
  const emailTaken = isApiError(register.error) && register.error.status === 409;
  const formError = register.isError && !emailTaken ? errorMessage(register.error) : null;

  function change(field: Field) {
    return (value: string) => {
      setValues((current) => ({ ...current, [field]: value }));
      if (fieldErrors[field]) setFieldErrors((current) => ({ ...current, [field]: null }));
      if (register.isError) register.reset();
    };
  }

  function submit() {
    if (register.isPending) return;
    const errors: FieldErrors = {
      name: nameError(values.name),
      email: emailError(values.email),
      password: passwordError(values.password),
    };
    setFieldErrors(errors);
    if (errors.name || errors.email || errors.password) return;
    register.mutate(values);
  }

  return (
    <Screen>
      <Header title="Tạo tài khoản" back />
      <FormScroll contentStyle={styles.body}>
        <TextField
          label="Họ và tên"
          value={values.name}
          onChangeText={change('name')}
          placeholder="Nguyễn Văn An"
          autoComplete="name"
          textContentType="name"
          autoCapitalize="words"
          returnKeyType="next"
          onSubmitEditing={() => emailRef.current?.focus()}
          error={fieldErrors.name}
          editable={!register.isPending}
          maxLength={80}
        />
        <TextField
          ref={emailRef}
          label="Email"
          value={values.email}
          onChangeText={change('email')}
          placeholder="ten@fpt.edu.vn"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          error={fieldErrors.email ?? (emailTaken ? errorMessage(register.error) : null)}
          editable={!register.isPending}
        />
        <TextField
          ref={passwordRef}
          label="Mật khẩu"
          value={values.password}
          onChangeText={change('password')}
          placeholder="Ít nhất 8 ký tự"
          password
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={submit}
          error={fieldErrors.password}
          editable={!register.isPending}
          maxLength={128}
        />
      </FormScroll>
      <ActionBar>
        <FormAlert message={formError} />
        <Button label="Đăng ký" busyLabel="Đang tạo tài khoản" busy={register.isPending} onPress={submit} block size="large" />
        <View style={styles.loginRow}>
          <Text style={styles.loginText}>Đã có tài khoản?</Text>
          <Pressable accessibilityRole="link" onPress={() => router.replace('/login')} style={styles.loginLink}>
            <Text style={styles.loginLinkText}>Đăng nhập</Text>
          </Pressable>
        </View>
      </ActionBar>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.xl, paddingVertical: spacing.xl, paddingLeft: spacing.contentLeft, paddingRight: spacing.contentRight },
  loginRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  loginText: { fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary },
  loginLink: { minHeight: 44, justifyContent: 'center' },
  loginLinkText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink, textDecorationLine: 'underline' },
});
