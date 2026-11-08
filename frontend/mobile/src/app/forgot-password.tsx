import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { errorMessage } from '@/api/errors';
import { useForgotPassword, useResetPassword } from '@/api/hooks/useAccount';
import { ActionBar, Button, FormAlert, FormScroll, Header, MessageState, Screen, TextField } from '@/components';
import { colors, fonts, sizes, spacing, type } from '@/theme';
import { confirmPasswordError, emailError, passwordError, resetCodeError } from '@/utils/validation';

type CodeErrors = { code: string | null; password: string | null; confirm: string | null };
const NO_CODE_ERRORS: CodeErrors = { code: null, password: null, confirm: null };

/**
 * Two steps: send a reset code by email, then enter the code with a new password.
 * The backend answers the same way whether or not the email has an account, and 503 when it can't send email.
 */
export default function ForgotPasswordScreen() {
  const forgot = useForgotPassword();
  const reset = useResetPassword();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [emailFieldError, setEmailFieldError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [codeErrors, setCodeErrors] = useState<CodeErrors>(NO_CODE_ERRORS);
  const [resent, setResent] = useState(false);

  function sendCode() {
    if (forgot.isPending) return;
    const error = emailError(email);
    setEmailFieldError(error);
    if (error) return;
    forgot.mutate(email, { onSuccess: () => setStep('code') });
  }

  function resendCode() {
    setResent(false);
    reset.reset();
    forgot.mutate(email, { onSuccess: () => setResent(true) });
  }

  function submitReset() {
    if (reset.isPending) return;
    const errors: CodeErrors = {
      code: resetCodeError(code),
      password: passwordError(password),
      confirm: confirmPasswordError(password, confirm),
    };
    setCodeErrors(errors);
    if (errors.code || errors.password || errors.confirm) return;
    reset.mutate({ token: code, newPassword: password });
  }

  function editCode(setter: (value: string) => void, field: keyof CodeErrors) {
    return (value: string) => {
      setter(value);
      if (codeErrors[field]) setCodeErrors((current) => ({ ...current, [field]: null }));
      if (reset.isError) reset.reset();
    };
  }

  if (reset.isSuccess) {
    return (
      <Screen>
        <Header title="Đặt lại mật khẩu" back />
        <MessageState
          heading="Đã đổi mật khẩu"
          sentence="Hãy đăng nhập bằng mật khẩu mới. Các thiết bị khác đã được đăng xuất."
          action={{ label: 'Đăng nhập', variant: 'primary', onPress: () => router.replace('/login') }}
        />
      </Screen>
    );
  }

  if (step === 'email') {
    return (
      <Screen>
        <Header title="Quên mật khẩu" back />
        <FormScroll contentStyle={styles.body}>
          <Text style={type.body}>Nhập email đã đăng ký. StudySpot sẽ gửi một mã để bạn đặt mật khẩu mới.</Text>
          <TextField
            label="Email"
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              if (emailFieldError) setEmailFieldError(null);
              if (forgot.isError) forgot.reset();
            }}
            placeholder="ten@fpt.edu.vn"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="send"
            onSubmitEditing={sendCode}
            error={emailFieldError}
            editable={!forgot.isPending}
          />
        </FormScroll>
        <ActionBar>
          <FormAlert message={forgot.isError ? errorMessage(forgot.error) : null} />
          <Button label="Gửi mã" busyLabel="Đang gửi" busy={forgot.isPending} onPress={sendCode} block size="large" />
        </ActionBar>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="Đặt lại mật khẩu" back onBack={() => setStep('email')} />
      <FormScroll contentStyle={styles.body}>
        <View style={styles.intro}>
          <Text style={type.body}>
            Nếu {email.trim().toLowerCase()} có tài khoản, mã đã được gửi tới hộp thư. Mã có hiệu lực 30 phút; hãy xem cả thư rác.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ busy: forgot.isPending }}
            disabled={forgot.isPending}
            onPress={resendCode}
            style={styles.linkButton}>
            <Text style={styles.link}>{forgot.isPending ? 'Đang gửi lại' : 'Gửi lại mã'}</Text>
          </Pressable>
          {resent ? <Text style={styles.notice}>Đã gửi mã mới. Mã cũ không dùng được nữa.</Text> : null}
          <FormAlert message={forgot.isError ? errorMessage(forgot.error) : null} />
        </View>
        <TextField
          label="Mã trong email"
          value={code}
          onChangeText={editCode(setCode, 'code')}
          placeholder="Dán mã gồm 64 ký tự"
          autoCapitalize="none"
          autoCorrect={false}
          error={codeErrors.code}
          editable={!reset.isPending}
        />
        <TextField
          label="Mật khẩu mới"
          value={password}
          onChangeText={editCode(setPassword, 'password')}
          placeholder="Ít nhất 8 ký tự"
          password
          autoComplete="new-password"
          textContentType="newPassword"
          error={codeErrors.password}
          editable={!reset.isPending}
          maxLength={128}
        />
        <TextField
          label="Nhập lại mật khẩu mới"
          value={confirm}
          onChangeText={editCode(setConfirm, 'confirm')}
          password
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={submitReset}
          error={codeErrors.confirm}
          editable={!reset.isPending}
          maxLength={128}
        />
      </FormScroll>
      <ActionBar>
        <FormAlert message={reset.isError ? errorMessage(reset.error) : null} />
        <Button label="Đặt lại mật khẩu" busyLabel="Đang lưu" busy={reset.isPending} onPress={submitReset} block size="large" />
      </ActionBar>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.xl, paddingVertical: spacing.xl, paddingLeft: spacing.contentLeft, paddingRight: spacing.contentRight },
  intro: { gap: spacing.xs },
  linkButton: { minHeight: sizes.touchTarget, justifyContent: 'center', alignSelf: 'flex-start' },
  link: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink, textDecorationLine: 'underline' },
  notice: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.ink },
});
