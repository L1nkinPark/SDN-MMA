import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, type } from '@/theme';

import { Button } from './Button';

type MessageStateProps = {
  heading: string;
  sentence: string;
  /** Error headings are red. */
  tone?: 'normal' | 'error';
  action?: {
    label: string;
    onPress: () => void;
    /** primary for sign-in and create actions, secondary for retry and navigation. */
    variant?: 'primary' | 'secondary';
    busy?: boolean;
  };
};

/** Left-aligned empty, error or guest state: heading, one sentence, one button. */
export function MessageState({ heading, sentence, tone = 'normal', action }: MessageStateProps) {
  return (
    <View style={styles.root}>
      <Text accessibilityRole="header" style={[type.heading, tone === 'error' ? styles.error : null]}>
        {heading}
      </Text>
      <Text style={type.body}>{sentence}</Text>
      {action ? (
        <Button
          label={action.label}
          onPress={action.onPress}
          variant={action.variant ?? 'secondary'}
          size="medium"
          busy={action.busy}
          style={styles.button}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingTop: spacing.xxxl,
    paddingLeft: spacing.contentLeft,
    paddingRight: spacing.contentRight,
  },
  error: { color: colors.error },
  button: { marginTop: spacing.sm },
});
