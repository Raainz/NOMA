/**
 * NOMA Reusable UI Components
 * Premium Lifestyle design system with lime green accent
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextInput as RNTextInput,
  TextStyle,
  ActivityIndicator,
  Animated,
  Pressable,
} from 'react-native';

import { colors, fonts, motion, radius } from '../theme/tokens';
import { useReducedMotion } from '../theme/useReducedMotion';
import { Icon } from './Icons';

// Legacy palette object, now derived from the design tokens (app/theme/tokens.ts).
export const NOMA_COLORS = {
  // Brand palette
  carbon: colors.carbon,
  sand: colors.sand,
  coral: colors.coral, // Action: buttons, CTA, route trace
  mediterranean: colors.sky,
  lime: colors.lime, // Performance: data, records, sport markers
  seaGreen: colors.seaGreen,

  // Legacy names kept so existing screens keep working
  charcoal: colors.carbon,
  offWhite: colors.sand,
  greige: colors.border,
  sage: colors.inactive,

  // Semantic aliases used across screens
  primary: colors.carbon,
  primaryDark: '#0B0E0C',
  background: colors.sand,
  backgroundLight: '#ECE7DA',
  surface: colors.surface,
  surfaceLight: '#EDE8DC',
  text: colors.text,
  textSecondary: colors.textSecondary,
  accent: colors.lime,
  accentLight: '#DCF8A5',
  success: colors.success,
  danger: colors.error,
  warning: colors.warning,
  runBackground: colors.runBackground,
};

/** Brand typography: Plus Jakarta Sans for titles and figures, Inter for interface text. */
export const FONTS = fonts;

/** Short coral bar: NOMA signature accent under titles and the logo. */
export const AccentBar: React.FC<{ color?: string; width?: number; style?: ViewStyle }> = ({
  color = NOMA_COLORS.coral,
  width = 36,
  style,
}) => <View style={[{ width, height: 4, borderRadius: 2, backgroundColor: color }, style]} />;

/** Letter-spaced NOMA wordmark with the lime bar. */
export const Wordmark: React.FC<{ color?: string; tagline?: boolean; size?: number }> = ({
  color = NOMA_COLORS.carbon,
  tagline = false,
  size = 26,
}) => (
  <View>
    <Text style={{ fontFamily: FONTS.headingMedium, fontSize: size, letterSpacing: size * 0.35, color }}>NOMA</Text>
    <AccentBar style={{ marginTop: 8 }} />
    {tagline ? (
      <Text style={{ fontFamily: FONTS.body, fontSize: 10, letterSpacing: 3, color, opacity: 0.8, marginTop: 10 }}>
        MOVE WITH INTENT.
      </Text>
    ) : null}
  </View>
);

/** Fades and slides children in on mount (subtle entrance animation). */
export const FadeInView: React.FC<{
  children: React.ReactNode;
  delay?: number;
  style?: ViewStyle;
}> = ({ children, delay = 0, style }) => {
  const progress = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) {
      progress.setValue(1);
      return;
    }
    Animated.timing(progress, {
      toValue: 1,
      duration: motion.screen + 100,
      delay,
      useNativeDriver: true,
    }).start();
  }, [progress, delay, reduced]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
};

/** Pressable with a light scale micro-animation. */
export const PressableScale: React.FC<{
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: ViewStyle | ViewStyle[];
  accessibilityLabel?: string;
}> = ({ children, onPress, disabled, style, accessibilityLabel }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const reduced = useReducedMotion();
  const to = (value: number) => {
    if (reduced) return;
    Animated.timing(scale, { toValue: value, duration: motion.press, useNativeDriver: true }).start();
  };
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPressIn={() => to(0.97)}
      onPressOut={() => to(1)}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
};

// Typography Styles
const styles = StyleSheet.create({
  // Text Styles
  titleLarge: {
    fontSize: 32,
    fontWeight: '700',
    color: NOMA_COLORS.text,
    letterSpacing: -0.5,
  },
  titleMedium: {
    fontSize: 24,
    fontWeight: '700',
    color: NOMA_COLORS.text,
    letterSpacing: -0.3,
  },
  titleSmall: {
    fontSize: 18,
    fontWeight: '700',
    color: NOMA_COLORS.text,
  },
  bodyLarge: {
    fontSize: 16,
    fontWeight: '500',
    color: NOMA_COLORS.text,
    lineHeight: 24,
  },
  bodyMedium: {
    fontSize: 14,
    fontWeight: '400',
    color: NOMA_COLORS.text,
    lineHeight: 22,
  },
  bodySmall: {
    fontSize: 12,
    fontWeight: '400',
    color: NOMA_COLORS.textSecondary,
    lineHeight: 18,
  },
  labelLarge: {
    fontSize: 14,
    fontWeight: '600',
    color: NOMA_COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  labelSmall: {
    fontSize: 11,
    fontWeight: '600',
    color: NOMA_COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
});

// Button Components
export const Button: React.FC<{
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'action';
  size?: 'large' | 'medium' | 'small';
  disabled?: boolean;
  loading?: boolean;
  /** Shows a confirmation state (check) once the action really succeeded. */
  success?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
}> = ({
  label,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  success = false,
  icon,
  style,
}) => {
  const getBackgroundColor = () => {
    if (disabled) return NOMA_COLORS.surfaceLight;
    if (success) return NOMA_COLORS.success;
    switch (variant) {
      case 'primary':
      case 'action':
        return NOMA_COLORS.coral;
      case 'secondary':
        return NOMA_COLORS.surface;
      case 'danger':
        return NOMA_COLORS.danger;
      default:
        return NOMA_COLORS.coral;
    }
  };

  const getTextColor = () => {
    if (disabled) return NOMA_COLORS.textSecondary;
    if (success || variant === 'danger') return '#FFFFFF';
    return NOMA_COLORS.carbon; // carbon on coral keeps 6:1 contrast
  };

  const getMinHeight = () => (size === 'large' ? 54 : size === 'small' ? 44 : 48);

  const getPaddingVertical = () => {
    switch (size) {
      case 'large':
        return 16;
      case 'medium':
        return 12;
      case 'small':
        return 8;
      default:
        return 12;
    }
  };

  const getFontSize = () => {
    switch (size) {
      case 'large':
        return 16;
      case 'medium':
        return 14;
      case 'small':
        return 12;
      default:
        return 14;
    }
  };

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        {
          backgroundColor: getBackgroundColor(),
          paddingVertical: getPaddingVertical(),
          paddingHorizontal: 20,
          minHeight: getMinHeight(),
          borderRadius: radius.button,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          borderWidth: variant === 'secondary' ? 1 : 0,
          borderColor: NOMA_COLORS.greige,
          opacity: disabled ? 0.6 : 1,
        },
        ...(style ? [style] : []),
      ]}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} size="small" />
      ) : (
        <>
          {success ? (
            <View style={{ marginRight: 8 }}>
              <Icon name="check" size={18} color="#FFFFFF" />
            </View>
          ) : (
            icon && <View style={{ marginRight: 8 }}>{icon}</View>
          )}
          <Text
            style={{
              color: getTextColor(),
              fontSize: getFontSize(),
              fontFamily: FONTS.bodySemiBold,
              fontWeight: '600',
            }}
          >
            {label}
          </Text>
        </>
      )}
    </PressableScale>
  );
};

// Card Component
export const Card: React.FC<{
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  accessibilityLabel?: string;
}> = ({ children, style, onPress, accessibilityLabel }) => {
  const content = (
    <View
      style={[
        {
          backgroundColor: NOMA_COLORS.surface,
          borderRadius: radius.card,
          padding: 16,
          borderWidth: 1,
          borderColor: NOMA_COLORS.greige + '80',
          shadowColor: NOMA_COLORS.charcoal,
          shadowOpacity: 0.05,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 1,
        },
        style,
      ]}
    >
      {children}
    </View>
  );

  if (onPress) {
    return (
      <PressableScale onPress={onPress} accessibilityLabel={accessibilityLabel}>
        {content}
      </PressableScale>
    );
  }

  return content;
};

// Stat Display Component (for showing distance, pace, etc.)
export const StatDisplay: React.FC<{
  label: string;
  value: string;
  unit?: string;
  highlight?: boolean;
}> = ({ label, value, unit, highlight = false }) => {
  return (
    <View
      style={{
        alignItems: 'center',
        paddingVertical: 12,
      }}
    >
      <Text style={styles.labelSmall}>{label}</Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          marginTop: 4,
        }}
      >
        <Text
          style={[
            styles.titleMedium,
            {
              color: NOMA_COLORS.text,
              fontSize: highlight ? 28 : 24,
            },
          ]}
        >
          {value}
        </Text>
        {unit && (
          <Text
            style={[
              styles.bodySmall,
              {
                marginLeft: 4,
                color: NOMA_COLORS.textSecondary,
              },
            ]}
          >
            {unit}
          </Text>
        )}
      </View>
    </View>
  );
};

// Progress Bar Component
export const ProgressBar: React.FC<{
  progress: number; // 0 to 1
  height?: number;
  backgroundColor?: string;
  progressColor?: string;
}> = ({
  progress,
  height = 4,
  backgroundColor = NOMA_COLORS.surfaceLight,
  progressColor = NOMA_COLORS.lime,
}) => {
  return (
    <View
      style={{
        width: '100%',
        height: height,
        backgroundColor: backgroundColor,
        borderRadius: height / 2,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: `${Math.max(0, Math.min(100, progress * 100))}%`,
          height: '100%',
          backgroundColor: progressColor,
          borderRadius: height / 2,
        }}
      />
    </View>
  );
};

// Badge Component
export const Badge: React.FC<{
  label: string;
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'coral' | 'neutral';
}> = ({ label, variant = 'primary' }) => {
  const getBackgroundColor = () => {
    switch (variant) {
      case 'primary':
      case 'success':
        return NOMA_COLORS.lime;
      case 'coral':
        return NOMA_COLORS.coral;
      case 'neutral':
        return NOMA_COLORS.surfaceLight;
      case 'warning':
        return NOMA_COLORS.warning;
      case 'danger':
        return NOMA_COLORS.danger;
      default:
        return NOMA_COLORS.lime;
    }
  };

  const getTextColor = () => (variant === 'danger' ? NOMA_COLORS.offWhite : NOMA_COLORS.charcoal);

  return (
    <View
      style={{
        backgroundColor: getBackgroundColor(),
        paddingVertical: 4,
        paddingHorizontal: 12,
        borderRadius: 12,
        alignSelf: 'flex-start',
      }}
    >
      <Text
        style={{
          color: getTextColor(),
          fontSize: 11,
          fontWeight: '600',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
    </View>
  );
};

// Input Component
export const TextInput: React.FC<{
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  style?: ViewStyle;
}> = ({ placeholder, value, onChangeText, style }) => {
  return (
    <View
      style={{
        backgroundColor: NOMA_COLORS.surfaceLight,
        borderRadius: 12,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: NOMA_COLORS.greige,
        ...style,
      } as ViewStyle}
    >
      <RNTextInput
        placeholder={placeholder}
        placeholderTextColor={NOMA_COLORS.textSecondary}
        value={value}
        onChangeText={onChangeText}
        style={{
          color: NOMA_COLORS.text,
          paddingVertical: 12,
          fontSize: 14,
        }}
      />
    </View>
  );
};

// Divider Component
export const Divider: React.FC<{
  color?: string;
  style?: ViewStyle;
}> = ({ color = NOMA_COLORS.surfaceLight, style }) => (
  <View
    style={[
      {
        height: 1,
        backgroundColor: color,
        marginVertical: 16,
      },
      style,
    ]}
  />
);

// Empty State Component
export const EmptyState: React.FC<{
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onPress: () => void;
  };
}> = ({ icon, title, description, action }) => (
  <View
    style={{
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
    }}
  >
    {icon && <View style={{ marginBottom: 16 }}>{icon}</View>}
    <Text style={[styles.titleMedium, { marginBottom: 8, textAlign: 'center' }]}>
      {title}
    </Text>
    <Text style={[styles.bodySmall, { textAlign: 'center', marginBottom: 24 }]}>
      {description}
    </Text>
    {action && (
      <Button label={action.label} onPress={action.onPress} size="large" />
    )}
  </View>
);
