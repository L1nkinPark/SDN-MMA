import { useState, type ComponentRef, type Ref, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { colors, fonts, sizes, spacing, type } from '@/theme';

import { Icon } from './Icon';

export type TextFieldProps = { ref?: Ref<ComponentRef<typeof TextInput>> } & Omit<TextInputProps, 'style'> & {
  label: string;
  /** Vietnamese error text shown under the field; also turns the label and line red. */
  error?: string | null;
  /** Adds the show/hide password button. */
  password?: boolean;
  /** Content on the right of the input, e.g. an icon button. */
  accessory?: ReactNode;
};

/** Underlined input with no box: 44px high, 1.5px line, label above. */
export function TextField({
  ref,
  label, error, password = false, accessory, onFocus, onBlur, ...inputProps
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const lineColor = error ? colors.error : focused ? colors.ink : colors.fieldLine;

  return (
    <View style={styles.field}>
      <Text style={[styles.label, error ? styles.labelError : null]}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholderTextColor={colors.placeholder}
          selectionColor={colors.ink}
          secureTextEntry={password && !revealed}
          autoCapitalize={password ? 'none' : inputProps.autoCapitalize}
          autoCorrect={password ? false : inputProps.autoCorrect}
          {...inputProps}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={[
            styles.input,
            { borderBottomColor: lineColor, borderBottomWidth: focused && !error ? 2 : sizes.fieldLine },
            password || accessory ? styles.inputWithAccessory : null,
          ]}
        />
        {password ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            onPress={() => setRevealed((value) => !value)}
            style={styles.accessory}>
            <Icon name="eye" color={colors.textSecondary} />
          </Pressable>
        ) : accessory ? (
          <View style={styles.accessory}>{accessory}</View>
        ) : null}
      </View>
      {error ? (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 2 },
  label: { ...type.label, color: colors.textSecondary },
  labelError: { color: colors.error },
  inputRow: { position: 'relative', justifyContent: 'center' },
  input: {
    height: sizes.touchTarget,
    padding: 0,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.text,
  },
  inputWithAccessory: { paddingRight: sizes.touchTarget },
  accessory: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: sizes.touchTarget,
    height: sizes.touchTarget,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  error: { ...type.error, marginTop: spacing.xs },
});
