import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fonts, sizes } from '@/theme';

import { Spinner } from './Spinner';

type ButtonProps = {
  label: string;
  onPress?: () => void;
  /** primary: filled ink, 54px. secondary: ink outline, 48px. */
  variant?: 'primary' | 'secondary';
  /** Override the height: 'large' is 54px, 'medium' 48px. Defaults by variant. */
  size?: 'large' | 'medium';
  /** Shows a spinner and `busyLabel`, and ignores presses. */
  busy?: boolean;
  busyLabel?: string;
  disabled?: boolean;
  /** Stretch to the container width (bottom action bars). */
  block?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size,
  busy = false,
  busyLabel,
  disabled = false,
  block = false,
  style,
  accessibilityHint,
}: ButtonProps) {
  const height = (size ?? (variant === 'primary' && block ? 'large' : 'medium')) === 'large' ? sizes.buttonPrimary : sizes.buttonSecondary;
  const inactive = disabled && !busy;
  const filled = variant === 'primary' && !inactive;
  const textColor = inactive ? colors.textSecondary : filled ? colors.onInk : colors.ink;
  const fontSize = height === sizes.buttonPrimary ? 16 : 15;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy, busy }}
      accessibilityHint={accessibilityHint}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { height },
        block ? styles.block : styles.inline,
        filled ? styles.primary : inactive ? styles.disabled : styles.secondary,
        pressed && !busy ? (filled ? styles.pressedFilled : styles.pressedOutline) : null,
        style,
      ]}>
      {busy ? <Spinner color={textColor} /> : null}
      <Text style={[styles.label, { color: textColor, fontSize }]}>{busy && busyLabel ? busyLabel : label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: sizes.radius,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  block: { alignSelf: 'stretch' },
  inline: { alignSelf: 'flex-start', paddingHorizontal: 20 },
  primary: { backgroundColor: colors.ink },
  secondary: { borderWidth: 1.5, borderColor: colors.ink },
  disabled: { borderWidth: 1.5, borderColor: colors.fieldLine },
  pressedFilled: { opacity: 0.7 },
  pressedOutline: { backgroundColor: colors.loading },
  label: { fontFamily: fonts.semibold },
});
