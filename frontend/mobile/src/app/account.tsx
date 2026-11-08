import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Switch, Text, View } from 'react-native';

import { errorMessage } from '@/api/errors';
import { authApi } from '@/api/auth';
import { useExportData, useUpdateMe } from '@/api/hooks/useAccount';
import { useMe } from '@/api/hooks/useMe';
import type { NotificationSettings } from '@/api/types';
import { useSession } from '@/auth/session';
import { Button, FormAlert, Header, Icon, LoadingList, MessageState, Screen, TextField } from '@/components';
import { colors, fonts, sizes, spacing, type } from '@/theme';
import { nameError } from '@/utils/validation';

function SectionTitle({ children }: { children: string }) {
  return (
    <Text accessibilityRole="header" style={styles.sectionTitle}>
      {children}
    </Text>
  );
}

function ToggleRow({ label, hint, value, disabled, onChange }: {
  label: string;
  hint: string;
  value: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={type.secondary}>{hint}</Text>
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{ false: colors.fieldLine, true: colors.ink }}
        thumbColor={colors.onInk}
      />
    </View>
  );
}

function LinkRow({ label, danger, onPress }: { label: string; danger?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} style={({ pressed }) => [styles.linkRow, pressed ? styles.pressed : null]}>
      <Text style={[styles.rowLabel, danger ? styles.danger : null]}>{label}</Text>
      <Icon name="chevron" size={18} color={danger ? colors.error : colors.textSecondary} />
    </Pressable>
  );
}

/** Tài khoản & bảo mật: display name, notification settings, password, data export and account deletion. */
export default function AccountScreen() {
  const { status, signOut } = useSession();
  const me = useMe();
  const update = useUpdateMe();
  const exportData = useExportData();
  const user = me.data?.user;
  // null until the user edits the field, so it shows the saved name without copying it into state.
  const [draftName, setDraftName] = useState<string | null>(null);
  const [nameFieldError, setNameFieldError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const requestEmail = useMutation({ mutationFn: () => authApi.requestEmailChange(newEmail, emailPassword) });
  const confirmEmail = useMutation({ mutationFn: () => authApi.confirmEmailChange(emailCode),
    onSuccess: () => { void signOut().then(() => router.replace('/login')); } });

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(timer);
  }, [notice]);

  if (status === 'guest') {
    return (
      <Screen>
        <Header title="Tài khoản" back />
        <MessageState
          heading="Đăng nhập để quản lý tài khoản"
          sentence="Tên hiển thị, thông báo và mật khẩu gắn với tài khoản của bạn."
          action={{ label: 'Đăng nhập', variant: 'primary', onPress: () => router.push('/login') }}
        />
      </Screen>
    );
  }

  if (!user) {
    return (
      <Screen>
        <Header title="Tài khoản" back />
        {me.isError ? (
          <MessageState
            tone="error"
            heading="Chưa tải được tài khoản"
            sentence={errorMessage(me.error)}
            action={{ label: 'Thử lại', onPress: () => me.refetch(), busy: me.isFetching }}
          />
        ) : (
          <LoadingList rows={3} />
        )}
      </Screen>
    );
  }

  const settings: NotificationSettings = user.notificationSettings ?? {};
  const name = draftName ?? user.name ?? '';
  const nameChanged = name.trim() !== (user.name ?? '');

  function saveName() {
    const error = nameError(name);
    setNameFieldError(error);
    if (error || !nameChanged) return;
    setNotice(null);
    update.mutate(
      { name: name.trim() },
      {
        onSuccess: () => {
          setDraftName(null);
          setNotice('Đã lưu tên hiển thị.');
        },
      },
    );
  }

  function toggle(key: keyof NotificationSettings, value: boolean) {
    setNotice(null);
    update.mutate({ notificationSettings: { [key]: value } });
  }

  function shareExport() {
    exportData.mutate(undefined, {
      onSuccess: (data) => {
        Share.share({ title: 'Dữ liệu StudySpot của tôi', message: JSON.stringify(data, null, 2) }).catch(() => undefined);
      },
    });
  }

  return (
    <Screen>
      <Header title="Tài khoản" back />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <SectionTitle>Hồ sơ</SectionTitle>
          <Text style={type.secondary}>Email đăng nhập: {user.email}</Text>
          <TextField
            label="Tên hiển thị"
            value={name}
            onChangeText={(value) => {
              setDraftName(value);
              if (nameFieldError) setNameFieldError(null);
            }}
            autoCapitalize="words"
            maxLength={80}
            error={nameFieldError}
            editable={!update.isPending}
            returnKeyType="done"
            onSubmitEditing={saveName}
          />
          <Button
            label="Lưu tên"
            variant="secondary"
            size="medium"
            disabled={!nameChanged}
            busy={update.isPending && update.variables?.name !== undefined}
            onPress={saveName}
          />
        </View>

        <View style={styles.section}>
          <SectionTitle>Đổi email đăng nhập</SectionTitle>
          <Text style={type.secondary}>Nhập mật khẩu hiện tại. Mã xác nhận sẽ được gửi đến email mới và có hiệu lực 30 phút.</Text>
          <TextField label="Email mới" value={newEmail} onChangeText={setNewEmail} autoCapitalize="none" keyboardType="email-address" />
          <TextField label="Mật khẩu hiện tại" value={emailPassword} onChangeText={setEmailPassword} secureTextEntry />
          <Button label="Gửi mã xác nhận" size="medium" variant="secondary" disabled={!newEmail.trim() || !emailPassword}
            busy={requestEmail.isPending} onPress={() => requestEmail.mutate()} />
          {requestEmail.isSuccess ? <Text style={type.secondary}>Đã xếp hàng gửi mã tới {newEmail.trim()}.</Text> : null}
          <FormAlert message={requestEmail.isError ? errorMessage(requestEmail.error) : null} />
          <TextField label="Mã trong email mới" value={emailCode} onChangeText={setEmailCode} autoCapitalize="none" />
          <Button label="Xác nhận email mới" size="medium" variant="secondary" disabled={!emailCode.trim()}
            busy={confirmEmail.isPending} onPress={() => confirmEmail.mutate()} />
          <FormAlert message={confirmEmail.isError ? errorMessage(confirmEmail.error) : null} />
        </View>

        <View style={styles.section}>
          <SectionTitle>Thông báo</SectionTitle>
          <ToggleRow
            label="Thông báo trong ứng dụng"
            hint="Đặt chỗ, báo cáo và kết quả duyệt hiện ở mục Thông báo."
            value={settings.inApp !== false}
            disabled={update.isPending}
            onChange={(value) => toggle('inApp', value)}
          />
          <ToggleRow
            label="Email"
            hint="Gửi bản sao các thông báo tới email của bạn."
            value={settings.email !== false}
            disabled={update.isPending}
            onChange={(value) => toggle('email', value)}
          />
        </View>

        <View style={styles.status}>
          <FormAlert message={update.isError ? errorMessage(update.error) : null} />
          {notice ? (
            <Text accessibilityLiveRegion="polite" style={styles.notice}>
              {notice}
            </Text>
          ) : null}
        </View>

        <View style={styles.section}>
          <SectionTitle>Bảo mật và dữ liệu</SectionTitle>
          <View>
            <LinkRow label="Đổi mật khẩu" onPress={() => router.push('/change-password')} />
            <LinkRow label="Khiếu nại của tôi" onPress={() => router.push('/cases')} />
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ busy: exportData.isPending }}
              disabled={exportData.isPending}
              onPress={shareExport}
              style={({ pressed }) => [styles.linkRow, pressed ? styles.pressed : null]}>
              <Text style={styles.rowLabel}>{exportData.isPending ? 'Đang chuẩn bị dữ liệu' : 'Xuất dữ liệu cá nhân'}</Text>
              <Icon name="chevron" size={18} color={colors.textSecondary} />
            </Pressable>
            {user.role !== 'admin' ? (
              <LinkRow label="Xóa tài khoản" danger onPress={() => router.push('/delete-account')} />
            ) : null}
          </View>
          <FormAlert message={exportData.isError ? errorMessage(exportData.error) : null} />
          <Text style={type.secondary}>
            Bản xuất gồm hồ sơ, đánh giá, check-in, báo cáo và đặt chỗ của bạn ở dạng JSON.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.xxl, paddingTop: spacing.xl, paddingBottom: spacing.xxxl },
  section: { gap: spacing.md, paddingLeft: spacing.contentLeft, paddingRight: spacing.contentRight },
  sectionTitle: { ...type.rowTitle, paddingBottom: spacing.xs, borderBottomWidth: sizes.titleRule, borderBottomColor: colors.ink },
  status: { paddingLeft: spacing.contentLeft, paddingRight: spacing.contentRight, gap: spacing.xs },
  toggleRow: {
    minHeight: sizes.rowMinHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: sizes.rowRule,
    borderBottomColor: colors.rule,
  },
  toggleText: { flex: 1, gap: 2 },
  rowLabel: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 22, color: colors.text },
  danger: { color: colors.error },
  linkRow: {
    minHeight: sizes.rowMinHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: sizes.rowRule,
    borderBottomColor: colors.rule,
  },
  pressed: { opacity: 0.6 },
  notice: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.ink },
});
