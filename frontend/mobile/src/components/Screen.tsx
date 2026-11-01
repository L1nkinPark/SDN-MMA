import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { colors, spacing } from '@/theme';

type ScreenProps = {
  children: ReactNode;
  style?: ViewStyle;
};

/** Paper background with the red margin line at x=24 running the full height of the screen. */
export function Screen({ children, style }: ScreenProps) {
  return (
    <View style={[styles.root, style]}>
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.margin} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  margin: {
    position: 'absolute',
    left: spacing.marginLineX,
    top: 0,
    bottom: 0,
    width: spacing.marginLineWidth,
    backgroundColor: colors.margin,
    zIndex: 1,
  },
});
