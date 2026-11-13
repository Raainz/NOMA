/**
 * NOMA system components: Chip, Field, Skeleton, SystemState.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, Text, TextInput, View, ViewStyle, TextInputProps } from 'react-native';
import { colors, fonts, motion, radius, TOUCH_TARGET } from '../theme/tokens';
import { useReducedMotion } from '../theme/useReducedMotion';
import { Button } from './UIComponents';
import { Icon, IconName } from './Icons';

/** Selectable chip / segmented option. Selected state = carbon fill, never color alone (also bold). */
export const Chip: React.FC<{
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}> = ({ label, selected = false, onPress, style }) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityState={{ selected }}
    style={[
      {
        minHeight: TOUCH_TARGET,
        paddingHorizontal: 16,
        borderRadius: radius.pill,
        justifyContent: 'center',
        backgroundColor: selected ? colors.carbon : colors.surface,
        borderWidth: 1,
        borderColor: selected ? colors.carbon : colors.border,
      },
      style,
    ]}
  >
    <Text
      style={{
        fontFamily: selected ? fonts.bodySemiBold : fonts.bodyMedium,
        fontSize: 13,
        color: selected ? colors.sand : colors.text,
      }}
    >
      {label}
    </Text>
  </Pressable>
);

/** Labelled text field with persistent label, helper and inline error. */
export const Field: React.FC<
  TextInputProps & { label: string; helper?: string; error?: string | null }
> = ({ label, helper, error, style, ...rest }) => (
  <View style={{ marginBottom: 16 }}>
    <Text style={{ fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.text, marginBottom: 6 }}>{label}</Text>
    <TextInput
      accessibilityLabel={label}
      placeholderTextColor={colors.inactive}
      style={[
        {
          minHeight: 52,
          borderRadius: radius.control,
          borderWidth: 1,
          borderColor: error ? colors.error : colors.border,
          backgroundColor: colors.surface,
          paddingHorizontal: 14,
          fontFamily: fonts.body,
          fontSize: 15,
          color: colors.text,
        },
        style,
      ]}
      {...rest}
    />
    {error ? (
      <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.error, marginTop: 6 }}>{error}</Text>
    ) : helper ? (
      <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary, marginTop: 6 }}>{helper}</Text>
    ) : null}
  </View>
);

/** Placeholder block that pulses (static when reduced motion is on). */
export const Skeleton: React.FC<{ width?: number | string; height?: number; style?: ViewStyle }> = ({
  width = '100%',
  height = 16,
  style,
}) => {
  const opacity = useRef(new Animated.Value(0.5)).current;
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: motion.skeleton / 2, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: motion.skeleton / 2, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, reduced]);
  return (
    <Animated.View
      accessibilityElementsHidden
      style={[
        { width: width as any, height, borderRadius: radius.control, backgroundColor: colors.border, opacity },
        style,
      ]}
    />
  );
};

/** Empty / error / offline / unavailable state with an optional recovery action. */
export const SystemState: React.FC<{
  icon?: IconName;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: 'neutral' | 'error';
}> = ({ icon = 'alert', title, message, actionLabel, onAction, tone = 'neutral' }) => (
  <View style={{ alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 }} accessibilityRole="alert">
    <View
      style={{
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
      }}
    >
      <Icon name={icon} size={28} color={tone === 'error' ? colors.error : colors.carbon} />
    </View>
    <Text style={{ fontFamily: fonts.heading, fontSize: 19, color: colors.text, textAlign: 'center' }}>{title}</Text>
    {message ? (
      <Text
        style={{
          fontFamily: fonts.body,
          fontSize: 14,
          lineHeight: 21,
          color: colors.textSecondary,
          textAlign: 'center',
          marginTop: 8,
        }}
      >
        {message}
      </Text>
    ) : null}
    {actionLabel && onAction ? (
      <Button label={actionLabel} onPress={onAction} variant="secondary" style={{ marginTop: 20 }} />
    ) : null}
  </View>
);
