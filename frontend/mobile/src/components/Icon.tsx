import Svg, { Circle, Path } from 'react-native-svg';

import { colors } from '@/theme';

/** Icon paths copied from frontend/design (24x24 viewBox). */
const paths = {
  pin: 'M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  heart: 'M12 20.5 3.6 12.2a5.1 5.1 0 0 1 7.2-7.2L12 6.2 13.2 5a5.1 5.1 0 0 1 7.2 7.2L12 20.5Z',
  ranking: 'M4 20V12h5v8M9.5 20V5h5v15M15 20v-6h5v6M3 20h18',
  person: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7.5 8.5c.6-3.7 3.6-6 7.5-6s6.9 2.3 7.5 6',
  star: 'm12 2.5 2.9 6.2 6.8.8-5 4.7 1.3 6.8-6-3.4-6 3.4 1.3-6.8-5-4.7 6.8-.8L12 2.5Z',
  back: 'M15 5l-7 7 7 7',
  chevron: 'M9 5l7 7-7 7',
  close: 'M6 6l12 12M18 6 6 18',
  check: 'M5 12.5 10 17.5 19 7',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm5-2 4 4',
  filter: 'M4 7h10M18 7h2M4 17h2M10 17h10M16 9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM8 19.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  locate: 'M12 19a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm0-4a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM12 2v3M12 19v3M2 12h3M19 12h3',
  spinner: 'M12 3a9 9 0 1 0 9 9',
  eye: 'M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z',
} as const;

export type IconName = keyof typeof paths;

/** Icons drawn with square line caps in the design. */
const squareCaps: Partial<Record<IconName, true>> = {
  back: true,
  chevron: true,
  close: true,
  check: true,
  search: true,
  filter: true,
  locate: true,
  eye: true,
};

type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
  /** Filled icons are used for the active tab, saved hearts and rating stars. */
  filled?: boolean;
  strokeWidth?: number;
};

export function Icon({ name, size = 22, color = colors.textSecondary, filled = false, strokeWidth }: IconProps) {
  const isSpinner = name === 'spinner';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d={paths[name]}
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={strokeWidth ?? (isSpinner ? 2.4 : 1.7)}
        strokeLinecap={isSpinner ? 'round' : squareCaps[name] ? 'square' : 'butt'}
        strokeLinejoin="round"
      />
      {name === 'eye' ? <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={1.7} fill="none" /> : null}
    </Svg>
  );
}
