import { useState, type ComponentRef, type Ref } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { colors, fonts, sizes, spacing, type } from '@/theme';

export type TextAreaProps = { ref?: Ref<ComponentRef<typeof TextInput>> } & Omit<TextInputProps, 'style' | 'multiline'> & {
  label: string;
  error?: string | null;
  /** Visible lines; each line is 24px. */
  rows?: number;
  /** Shows "n/max" under the field when set together with maxLength. */
  showCount?: boolean;
};

/** Multi-line underlined input: 16px text on 24px lines, 1.5px line, no box. */
export function TextArea({
  ref,
  label, error, rows = 4, showCount = false, onFocus, onBlur, value, maxLength, ...inputProps
}: TextAreaProps) {
  const [focused, setFocused] = useState(false);
  const lineColor = error ? colors.error : focused ? colors.ink : colors.fieldLine;

  return (
    <View style={styles.field}>
      <Text style={[styles.label, error ? styles.labelError : null]}>{label}</Text>
      <TextInput
        ref={ref}
        multiline
        textAlignVertical="top"
        accessibilityLabel={label}
        placeholderTextColor={colors.placeholder}
        selectionColor={colors.ink}
        value={value}
        maxLength={maxLength}
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
          { minHeight: rows * 24 + 8, borderBottomColor: lineColor, borderBottomWidth: focused && !error ? 2 : sizes.fieldLine },
        ]}
      />
      {error || (showCount && maxLength) ? (
        <View style={styles.below}>
          <Text accessibilityLiveRegion="polite" style={[styles.error, styles.grow]}>
            {error ?? ''}
          </Text>
          {showCount && maxLength ? (
            <Text style={styles.count}>
              {(value ?? '').length}/{maxLength}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { ...type.label, color: colors.textSecondary },
  labelError: { color: colors.error },
  input: {
    paddingTop: 0,
    paddingHorizontal: 0,
    paddingBottom: spacing.sm,
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
  },
  below: { flexDirection: 'row', gap: spacing.md },
  grow: { flex: 1 },
  error: { ...type.error },
  count: { ...type.meta },
});
