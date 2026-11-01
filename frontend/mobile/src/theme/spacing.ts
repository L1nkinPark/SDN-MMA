/** Layout values shared by every screen. */
export const spacing = {
  /** Content starts this far from the left edge. */
  contentLeft: 40,
  /** Content ends this far from the right edge. */
  contentRight: 20,
  /** The red margin line sits at this x position. */
  marginLineX: 24,
  marginLineWidth: 1,
  /** Header top padding under the status bar area in the design. */
  headerTop: 64,
  headerBottom: 12,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const sizes = {
  tabBarHeight: 84,
  tabBarRule: 1.5,
  tabActiveBar: 3,
  titleRule: 1.5,
  rowRule: 1,
  fieldLine: 1.5,
  buttonPrimary: 54,
  buttonSecondary: 48,
  radius: 2,
  touchTarget: 44,
  rowMinHeight: 52,
  /** Live status meter bars: width, heights, gap. */
  meterBarWidth: 6,
  meterBarHeights: [8, 13, 18] as const,
  meterGap: 2,
} as const;
