import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { errorMessage } from '@/api/errors';
import { useMe } from '@/api/hooks/useMe';
import { useRefetchOnFocus } from '@/api/hooks/useRefetchOnFocus';
import { useSession } from '@/auth/session';
import { Header, Icon, LoadingList, MessageState, Screen } from '@/components';
import { colors, fonts, sizes, spacing, type } from '@/theme';

function LinkRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} style={({ pressed }) => [styles.link, pressed ? styles.pressed : null]}>
      <Text style={styles.linkText}>{label}</Text>
      <Icon name="chevron" size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

export default function ProfileScreen() {
  const { status, signOut } = useSession();
  const me = useMe();
  const [signingOut, setSigningOut] = useState(false);

  useRefetchOnFocus(me.refetch, status === 'signed-in');

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  }

  const user = me.data?.user;

  let body;
  if (status === 'guest') {
    body = (
      <MessageState
        heading="Đăng nhập để check-in và tích điểm"
        sentence="Bạn vẫn xem được địa điểm mà không cần tài khoản."
        action={{ label: 'Đăng nhập', variant: 'primary', onPress: () => router.push('/login') }}
      />
    );
  } else if (status === 'loading' || (me.isPending && !me.isError)) {
    body = <LoadingList rows={2} />;
  } else if (!user) {
    body = (
      <MessageState
        tone="error"
        heading="Chưa tải được hồ sơ"
        sentence={errorMessage(me.error)}
        action={{ label: 'Thử lại', onPress: () => me.refetch(), busy: me.isFetching }}
      />
    );
  } else {
    body = (
      <ScrollView>
        <View style={styles.identity}>
          <Text style={type.heading}>{user.name}</Text>
          <Text style={styles.email}>{user.email}</Text>
        </View>
        <View style={styles.points}>
          <Text style={type.secondary}>Điểm đóng góp</Text>
          <Text style={styles.pointsValue}>{user.reputation ?? 0}</Text>
          <Text style={type.secondary}>+1 cho check-in đầu tiên trong ngày tại một địa điểm, +2 cho đánh giá đầu tiên.</Text>
        </View>
        <LinkRow label="Báo cáo của tôi" onPress={() => router.push('/my-reports')} />
        <LinkRow label="Đặt chỗ của tôi" onPress={() => router.push('/my-bookings')} />
        <LinkRow label="Thông báo" onPress={() => router.push('/notifications')} />
        <LinkRow label="Tài khoản & bảo mật" onPress={() => router.push('/account')} />
        <LinkRow label="Đề xuất địa điểm" onPress={() => router.push('/propose')} />
        <View style={styles.signOutRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: signingOut, busy: signingOut }}
            disabled={signingOut}
            onPress={handleSignOut}
            style={styles.signOut}>
            <Text style={[styles.signOutText, signingOut ? styles.pressed : null]}>Đăng xuất</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <Screen>
      <Header title="Hồ sơ" />
      {body}
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: {
    gap: 2,
    paddingVertical: spacing.lg,
    paddingLeft: spacing.contentLeft,
    paddingRight: spacing.contentRight,
    borderBottomWidth: sizes.rowRule,
    borderBottomColor: colors.rule,
  },
  email: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.textSecondary },
  points: {
    gap: 6,
    paddingVertical: spacing.lg,
    paddingLeft: spacing.contentLeft,
    paddingRight: spacing.contentRight,
    borderBottomWidth: sizes.titleRule,
    borderBottomColor: colors.ink,
  },
  pointsValue: { fontFamily: fonts.title, fontSize: 56, lineHeight: 58, color: colors.ink },
  link: {
    minHeight: sizes.rowMinHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: spacing.contentLeft,
    paddingRight: spacing.contentRight,
    borderBottomWidth: sizes.rowRule,
    borderBottomColor: colors.rule,
  },
  linkText: { fontFamily: fonts.medium, fontSize: 15, color: colors.text },
  pressed: { opacity: 0.6 },
  signOutRow: { paddingTop: spacing.sm, paddingLeft: spacing.contentLeft, paddingRight: spacing.contentRight },
  signOut: { minHeight: sizes.touchTarget, justifyContent: 'center', alignSelf: 'flex-start' },
  signOutText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.error },
});
