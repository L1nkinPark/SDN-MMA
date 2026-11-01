import type { TextStyle } from 'react-native';

import { colors } from './colors';

/** Font family names as registered by useFonts in the root layout. */
export const fonts = {
  title: 'BarlowCondensed_700Bold',
  regular: 'BeVietnamPro_400Regular',
  medium: 'BeVietnamPro_500Medium',
  semibold: 'BeVietnamPro_600SemiBold',
  bold: 'BeVietnamPro_700Bold',
} as const;

export const fontSizes = {
  titleLogin: 68,
  title: 44,
  bigNumber: 56,
  brand: 24,
  heading: 18,
  input: 16,
  rowTitle: 16,
  body: 15,
  label: 14,
  secondary: 13,
  meta: 12,
} as const;

/** Ready-made text styles. Custom fonts carry their own weight, so no fontWeight is set. */
export const type = {
  screenTitle: { fontFamily: fonts.title, fontSize: fontSizes.title, lineHeight: 47, color: colors.ink },
  loginTitle: {
    fontFamily: fonts.title,
    fontSize: fontSizes.titleLogin,
    lineHeight: 72,
    letterSpacing: -0.5,
    color: colors.ink,
  },
  heading: { fontFamily: fonts.semibold, fontSize: fontSizes.heading, lineHeight: 26, color: colors.text },
  rowTitle: { fontFamily: fonts.semibold, fontSize: fontSizes.rowTitle, lineHeight: 22, color: colors.text },
  body: { fontFamily: fonts.regular, fontSize: fontSizes.body, lineHeight: 22, color: colors.textSecondary },
  label: { fontFamily: fonts.semibold, fontSize: fontSizes.secondary, lineHeight: 18, color: colors.text },
  secondary: { fontFamily: fonts.regular, fontSize: fontSizes.secondary, lineHeight: 18, color: colors.textSecondary },
  meta: { fontFamily: fonts.regular, fontSize: fontSizes.meta, lineHeight: 16, color: colors.textSecondary },
  error: { fontFamily: fonts.medium, fontSize: fontSizes.secondary, lineHeight: 18, color: colors.error },
} satisfies Record<string, TextStyle>;
