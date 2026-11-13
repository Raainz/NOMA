/**
 * Find public runners by handle, name or city, and follow them.
 * With few users the list is useful on its own: an empty search shows every public runner.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { api } from '../api';
import { RunnerSummary } from '../api/client';
import { fr } from '../i18n/fr';
import { Button, Card, FONTS, NOMA_COLORS, TextInput } from '../components/UIComponents';
import { Divider } from '../components/UIComponents';
import { RunnerRow, socialErrorMessage } from './socialShared';

export const RunnersScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [q, setQ] = useState('');
  const [city, setCity] = useState('');
  const [items, setItems] = useState<RunnerSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(
    async (next: string | null) => {
      const id = ++requestId.current;
      setLoading(true);
      setError(null);
      try {
        const page = await api.searchRunners({ q: q.trim(), city: city.trim(), cursor: next });
        if (id !== requestId.current) return; // a newer search replaced this one
        setItems((prev) => (next ? [...prev, ...page.items] : page.items));
        setCursor(page.next_cursor);
      } catch (e) {
        if (id === requestId.current) setError(socialErrorMessage(e));
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [q, city]
  );

  useEffect(() => {
    const t = setTimeout(() => load(null), 300);
    return () => clearTimeout(t);
  }, [load]);

  const toggleFollow = async (r: RunnerSummary) => {
    setBusyId(r.id);
    try {
      if (r.is_following) await api.unfollow(r.id);
      else await api.follow(r.id);
      setItems((prev) => prev.map((x) => (x.id === r.id ? { ...x, is_following: !r.is_following } : x)));
    } catch (e) {
      setError(socialErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: NOMA_COLORS.background }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <TextInput value={q} onChangeText={setQ} placeholder={fr.social.searchPlaceholder} autoCapitalize="none" autoCorrect={false} />
        <TextInput value={city} onChangeText={setCity} placeholder={fr.social.cityPlaceholder} style={{ marginTop: 10 }} />

        {error ? (
          <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 13, color: NOMA_COLORS.danger, marginTop: 14 }}>{error}</Text>
        ) : null}

        <Card style={{ marginTop: 16 }}>
          {items.length === 0 && !loading && !error ? (
            <Text style={{ fontFamily: FONTS.body, fontSize: 13, lineHeight: 19, color: NOMA_COLORS.textSecondary }}>{fr.social.noRunners}</Text>
          ) : null}
          {items.map((r, i) => (
            <View key={r.id}>
              {i > 0 ? <Divider style={{ marginVertical: 0 }} /> : null}
              <RunnerRow
                runner={r}
                busy={busyId === r.id}
                onOpen={() => navigation.navigate('RunnerProfile', { handle: r.handle })}
                onToggleFollow={() => toggleFollow(r)}
              />
            </View>
          ))}
          {loading ? <ActivityIndicator color={NOMA_COLORS.charcoal} style={{ marginVertical: 12 }} /> : null}
        </Card>

        {cursor && !loading ? (
          <View style={{ marginTop: 14 }}>
            <Button label="Voir plus" variant="secondary" size="small" onPress={() => load(cursor)} />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};
