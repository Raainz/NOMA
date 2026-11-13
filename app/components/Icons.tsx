/**
 * Monoline icon set (rounded caps, 1.8 stroke), consistent with the brand pictograms.
 */

import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '../theme/tokens';

export type IconName =
  | 'home'
  | 'compass'
  | 'activity'
  | 'calendar'
  | 'user'
  | 'pin'
  | 'route'
  | 'mountain'
  | 'star'
  | 'check'
  | 'wifi-off'
  | 'alert'
  | 'search'
  | 'play';

const PATHS: Record<IconName, React.ReactNode> = {
  home: <Path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />,
  compass: (
    <>
      <Circle cx={12} cy={12} r={9} />
      <Path d="M15.5 8.5l-2 5-5 2 2-5z" />
    </>
  ),
  activity: <Path d="M3 12h4l3-8 4 16 3-8h4" />,
  calendar: (
    <>
      <Path d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4" />
    </>
  ),
  user: (
    <>
      <Circle cx={12} cy={8} r={4} />
      <Path d="M4 20c1-4 4-6 8-6s7 2 8 6" />
    </>
  ),
  pin: (
    <>
      <Path d="M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11z" />
      <Circle cx={12} cy={10} r={2.5} />
    </>
  ),
  route: (
    <>
      <Circle cx={6} cy={18} r={2} />
      <Circle cx={18} cy={6} r={2} />
      <Path d="M8 18h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7" />
    </>
  ),
  mountain: <Path d="M3 19l6-11 4 7 3-5 5 9z" />,
  star: <Path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />,
  check: <Path d="M5 12.5l4.5 4.5L19 7.5" />,
  'wifi-off': <Path d="M3 3l18 18M8.5 16a5 5 0 0 1 7 0M5 12.5a10 10 0 0 1 4-2.4M19 12.5a10 10 0 0 0-5-2.8M12 20h.01" />,
  alert: (
    <>
      <Path d="M12 4l9 16H3z" />
      <Path d="M12 10v4M12 17h.01" />
    </>
  ),
  search: (
    <>
      <Circle cx={11} cy={11} r={6.5} />
      <Path d="M16 16l4.5 4.5" />
    </>
  ),
  play: <Path d="M8 5l11 7-11 7z" />,
};

export const Icon: React.FC<{ name: IconName; size?: number; color?: string }> = ({
  name,
  size = 24,
  color = colors.carbon,
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    {PATHS[name]}
  </Svg>
);
