/**
 * Small pieces shared by the social screens (M2): error messages, runner rows, formatting.
 */

import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { ApiError, RunnerSummary } from '../api/client';
import { fr } from '../i18n/fr';
import { Badge, Button, FONTS, NOMA_COLORS } from '../components/UIComponents';

export function socialErrorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.isNetwork) return e.message;
    return fr.social.errors[e.code] ?? fr.social.errors.fallback;
  }
  return fr.social.errors.fallback;
}

export const formatKm = (meters: number): string =>
  `${(meters / 1000).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;

export const runnerName = (r: { display_name: string | null; handle: string }): string => r.display_name || `@${r.handle}`;

export const RunnerRow: React.FC<{
  runner: RunnerSummary;
  onOpen: () => void;
  onToggleFollow: () => void;
  busy?: boolean;
}> = ({ runner, onOpen, onToggleFollow, busy }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 }}>
    <Pressable onPress={onOpen} accessibilityRole="button" style={{ flex: 1 }}>
      <Text style={{ fontFamily: FONTS.bodySemiBold, fontSize: 15, color: NOMA_COLORS.text }}>{runnerName(runner)}</Text>
      <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: NOMA_COLORS.textSecondary, marginTop: 2 }}>
        @{runner.handle}
        {runner.city ? ` · ${runner.city}` : ''}
      </Text>
      {runner.level ? (
        <View style={{ marginTop: 6 }}>
          <Badge label={fr.social.levels[runner.level]} variant="neutral" />
        </View>
      ) : null}
    </Pressable>
    <Button
      label={runner.is_following ? fr.social.followingLabel : fr.social.follow}
      size="small"
      variant={runner.is_following ? 'secondary' : 'primary'}
      loading={busy}
      onPress={onToggleFollow}
    />
  </View>
);
