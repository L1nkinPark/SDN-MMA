/** Shared StudySpot design tokens. */
export const colors = {
  paper: '#F6F7F9',
  ink: '#16308F',
  text: '#141A2E',
  textSecondary: '#3F4963',
  placeholder: '#5A647D',
  fieldLine: '#8C96AE',
  rule: '#C9D1E3',
  error: '#B8321C',
  loading: '#E1E5EF',
  onInk: '#FFFFFF',
} as const;

export type ColorName = keyof typeof colors;
