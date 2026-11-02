import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts, sizes, spacing, type } from '@/theme';

import { Icon } from './Icon';

type HeaderProps = {
  title: string;
  /** Shows the back button above the title. */
  back?: boolean;
  onBack?: () => void;
  /** Small text or control on the right of the title, e.g. a count. */
  right?: ReactNode;
};

/** In the 844px design the header starts 64px from the top (52px with a back button); ~44px of that is the status bar. */
const DESIGN_STATUS_BAR = 44;

export function Header({ title, back = false, onBack, right }: HeaderProps) {
  const insets = useSafeAreaInsets();
  const designTop = back ? 52 : spacing.headerTop;
  const paddingTop = Math.max(insets.top, 24) + (designTop - DESIGN_STATUS_BAR);

  return (
    <View style={[styles.header, { paddingTop }]}>
      {back ? (
        <View style={styles.backRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Quay lại"
            hitSlop={4}
            onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}
            style={styles.backButton}>
            <Icon name="back" color={colors.ink} />
          </Pressable>
        </View>
      ) : null}
      <View style={styles.titleRow}>
        <Text accessibilityRole="header" style={[type.screenTitle, styles.title]} numberOfLines={2}>
          {title}
        </Text>
        {typeof right === 'string' ? <Text style={styles.rightText}>{right}</Text> : right}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingLeft: spacing.contentLeft,
    paddingRight: spacing.contentRight,
    paddingBottom: spacing.headerBottom,
    borderBottomWidth: sizes.titleRule,
    borderBottomColor: colors.ink,
  },
  backRow: { flexDirection: 'row', marginLeft: -12 },
  backButton: { width: sizes.touchTarget, height: sizes.touchTarget, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.md },
  title: { flexShrink: 1 },
  rightText: { ...type.secondary, fontFamily: fonts.medium, paddingBottom: 6 },
});
