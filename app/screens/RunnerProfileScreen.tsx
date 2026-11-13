/**
 * A runner's public profile: summary, follow button and the activities they chose to share.
 * What is shown already respects the owner's visibility choices and privacy zone (server side).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { api } from '../api';
import { RunnerActivity, RunnerProfile } from '../api/client';
import { fr } from '../i18n/fr';
import { Badge, Button, Card, FONTS, NOMA_COLORS } from '../components/UIComponents';
import { SectionTitle, formatShortDate } from '../components/Blocks';
import { formatKm, runnerName, socialErrorMessage } from './socialShared';

export const RunnerProfileScreen: React.FC<{ route: { params: { handle: string } }; navigation: any }> = ({ route, navigation }) => {
  const { handle } = route.params;
  const [profile, setProfile] = useState<RunnerProfile | null>(null);
  const [activities, setActivities] = useState<RunnerActivity[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, a] = await Promise.all([api.runnerProfile(handle), api.runnerActivities(handle)]);
      setProfile(p);
      setActivities(a.items);
      setCursor(a.next_cursor);
    } catch (e) {
      setError(socialErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [handle]);

  useEffect(() => {
    load();
  }, [load]);

  const more = async () => {
    if (!cursor) return;
    try {
      const a = await api.runnerActivities(handle, { cursor });
      setActivities((prev) => [...prev, ...a.items]);
      setCursor(a.next_cursor);
    } catch (e) {
      setError(socialErrorMessage(e));
    }
  };

  const toggleFollow = async () => {
    if (!profile) return;
    setBusy(true);
    try {
      if (profile.is_following) await api.unfollow(profile.id);
      else await api.follow(profile.id);
      // Reload: the visible activities and counts depend on whether we follow.
      await load();
    } catch (e) {
      setError(socialErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: NOMA_COLORS.background }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        {loading && !profile ? <ActivityIndicator color={NOMA_COLORS.charcoal} style={{ marginTop: 40 }} /> : null}
        {error ? (
          <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 14, color: NOMA_COLORS.danger, marginBottom: 14 }}>{error}</Text>
        ) : null}
        {!profile && !loading ? <Button label="Retour" onPress={() => navigation.goBack()} /> : null}

        {profile ? (
          <>
            <Card>
              <Text style={{ fontFamily: FONTS.heading, fontSize: 22, color: NOMA_COLORS.text }}>{runnerName(profile)}</Text>
              <Text style={{ fontFamily: FONTS.body, fontSize: 14, color: NOMA_COLORS.textSecondary, marginTop: 2 }}>
                @{profile.handle}
                {profile.city ? ` · ${profile.city}` : ''}
              </Text>
              {profile.level ? (
                <View style={{ marginTop: 8 }}>
                  <Badge label={fr.social.levels[profile.level]} variant="neutral" />
                </View>
              ) : null}
              {profile.bio ? (
                <Text style={{ fontFamily: FONTS.body, fontSize: 14, lineHeight: 21, color: NOMA_COLORS.text, marginTop: 12 }}>{profile.bio}</Text>
              ) : null}
              <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 13, color: NOMA_COLORS.textSecondary, marginTop: 12 }}>
                {fr.social.followers(profile.followers_count)} · {fr.social.followingCount(profile.following_count)}
              </Text>
              <View style={{ marginTop: 14 }}>
                {profile.is_me ? (
                  <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: NOMA_COLORS.textSecondary }}>{fr.social.isMe}</Text>
                ) : (
                  <Button
                    label={profile.is_following ? fr.social.unfollow : fr.social.follow}
                    variant={profile.is_following ? 'secondary' : 'primary'}
                    size="small"
                    loading={busy}
                    onPress={toggleFollow}
                  />
                )}
              </View>
            </Card>

            <SectionTitle title={fr.social.sharedActivities} />
            <Card>
              <Text style={{ fontFamily: FONTS.bodySemiBold, fontSize: 15, color: NOMA_COLORS.text }}>
                {fr.common.activities(profile.activities_count)} · {formatKm(profile.total_distance_m)}
              </Text>
              {activities.length === 0 ? (
                <Text style={{ fontFamily: FONTS.body, fontSize: 13, lineHeight: 19, color: NOMA_COLORS.textSecondary, marginTop: 8 }}>
                  {fr.social.noSharedActivities}
                </Text>
              ) : null}
              {activities.map((a) => (
                <View key={a.id} style={{ paddingTop: 12 }}>
                  <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 14, color: NOMA_COLORS.text }}>{a.name}</Text>
                  <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: NOMA_COLORS.textSecondary, marginTop: 2 }}>
                    {formatShortDate(new Date(a.started_at).getTime())} · {formatKm(a.distance_m)}
                  </Text>
                </View>
              ))}
              {cursor ? (
                <View style={{ marginTop: 12 }}>
                  <Button label="Voir plus" variant="secondary" size="small" onPress={more} />
                </View>
              ) : null}
            </Card>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};
