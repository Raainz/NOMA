/**
 * Who can see one activity: private (default), followers or public.
 * Needs the activity to be uploaded (server id) and the profile to be public.
 */

import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { api } from '../api';
import { Visibility } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import { fr } from '../i18n/fr';
import { socialErrorMessage } from '../screens/socialShared';
import { Card, FONTS, NOMA_COLORS } from './UIComponents';
import { Chip } from './System';

const LEVELS: Visibility[] = ['private', 'followers', 'public'];

export const VisibilityCard: React.FC<{ activityId: string }> = ({ activityId }) => {
  const { user } = useAuth();
  const { serverIdOf } = useSync();
  const serverId = serverIdOf(activityId);
  const [current, setCurrent] = useState<Visibility>('private');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!serverId) return;
    let active = true;
    api
      .activityVisibility(serverId)
      .then((v) => active && setCurrent(v))
      .catch(() => undefined); // offline: keep showing the safe default
    return () => {
      active = false;
    };
  }, [serverId]);

  const choose = async (next: Visibility) => {
    if (!serverId || next === current || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.setActivityVisibility(serverId, next);
      setCurrent(next);
    } catch (e) {
      setError(socialErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const blocker = !serverId ? fr.social.needsSync : !user?.is_public && current === 'private' ? fr.social.needsPublicProfile : null;

  return (
    <Card style={{ marginTop: 16 }}>
      <Text style={{ fontFamily: FONTS.heading, fontSize: 17, color: NOMA_COLORS.text }}>{fr.social.visibility}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        {LEVELS.map((l) => (
          <Chip
            key={l}
            label={fr.social.visibilityLevels[l]}
            selected={current === l}
            onPress={() => choose(l)}
            style={!serverId || (l !== 'private' && !user?.is_public) ? { opacity: 0.5 } : undefined}
          />
        ))}
      </View>
      <Text style={{ fontFamily: FONTS.body, fontSize: 13, lineHeight: 19, color: NOMA_COLORS.textSecondary, marginTop: 10 }}>
        {blocker ?? fr.social.visibilityHelp[current]}
      </Text>
      {error ? (
        <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 13, color: NOMA_COLORS.danger, marginTop: 8 }}>{error}</Text>
      ) : null}
    </Card>
  );
};
