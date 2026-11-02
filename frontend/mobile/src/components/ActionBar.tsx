import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme';

/** Bottom bar under a scrolling body: holds the main button and a short note. */
export function ActionBar({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>{children}</View>;
}

const styles = StyleSheet.create({
  bar: {
    gap: spacing.sm,
    paddingTop: spacing.md,
    paddingLeft: spacing.contentLeft,
    paddingRight: spacing.contentRight,
    backgroundColor: colors.paper,
  },
});
