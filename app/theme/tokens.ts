/**
 * NOMA design tokens (single source of truth).
 * Merges the written design system and the brand-book images:
 * coral = action, lime = performance data, carbon/sand = structure.
 */

export const colors = {
  // Brand
  carbon: '#141916',
  sand: '#F5F1E8',
  coral: '#FF704F',
  lime: '#B9F34A',
  seaGreen: '#4C8F89',
  sky: '#9CC8D8',

  // Functional
  text: '#202522',
  /** Slightly darker than the spec (#737A75) so small captions reach 4.5:1 on sand. */
  textSecondary: '#666D68',
  surface: '#FFFFFF',
  surfaceSand: '#FBF9F4',
  border: '#E5E0D6',
  success: '#267F7B',
  warning: '#D99A42',
  error: '#C94F45',
  runBackground: '#101715',
  inactive: '#9AA39B',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 };

export const radius = { control: 12, button: 16, card: 22, sheet: 28, pill: 999 };

export const fonts = {
  heading: 'PlusJakartaSans_600SemiBold',
  headingBold: 'PlusJakartaSans_700Bold',
  headingMedium: 'PlusJakartaSans_500Medium',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
};

export const typeScale = {
  display: { fontSize: 38, lineHeight: 44 },
  h1: { fontSize: 30, lineHeight: 36 },
  h2: { fontSize: 23, lineHeight: 29 },
  h3: { fontSize: 19, lineHeight: 25 },
  body: { fontSize: 15, lineHeight: 22 },
  secondary: { fontSize: 13, lineHeight: 19 },
  caption: { fontSize: 11, lineHeight: 15 },
};

/** Animation durations (ms), per the design system. */
export const motion = {
  press: 120,
  select: 160,
  screen: 220,
  sheet: 260,
  route: 800,
  chart: 350,
  skeleton: 1400,
};

/** Minimum touch target (px). */
export const TOUCH_TARGET = 44;
