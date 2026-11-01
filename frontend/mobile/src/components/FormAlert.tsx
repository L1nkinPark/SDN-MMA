import { StyleSheet, Text } from 'react-native';

import { colors, fonts } from '@/theme';

/** Red form-level error, announced to screen readers. Renders nothing without a message. */
export function FormAlert({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.alert}>
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({
  alert: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: colors.error },
});
