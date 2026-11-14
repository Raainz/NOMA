/**
 * Public profile settings: handle, city, level and visibility of the profile.
 * Nothing is public until the user explicitly turns it on.
 */

import React, { useState } from 'react';
import { Alert, SafeAreaView, ScrollView, Switch, Text, View } from 'react-native';
import { api } from '../api';
import { Level } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { fr } from '../i18n/fr';
import { Button, Card, FONTS, NOMA_COLORS, TextInput } from '../components/UIComponents';
import { Chip } from '../components/System';
import { socialErrorMessage } from './socialShared';

const LEVELS: Level[] = ['debutant', 'intermediaire', 'confirme'];

const Label: React.FC<{ text: string }> = ({ text }) => (
  <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 13, color: NOMA_COLORS.textSecondary, marginTop: 14, marginBottom: 6 }}>
    {text}
  </Text>
);

export const ProfileEditScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user, refreshUser } = useAuth();
  const [handle, setHandle] = useState(user?.handle ?? '');
  const [displayName, setDisplayName] = useState(user?.display_name ?? '');
  const [city, setCity] = useState(user?.city ?? '');
  const [level, setLevel] = useState<Level | null>(user?.level ?? null);
  const [bio, setBio] = useState(user?.bio ?? '');
  const [isPublic, setIsPublic] = useState(user?.is_public ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    const cleanHandle = handle.trim().replace(/^@/, '').toLowerCase();
    if (isPublic && !cleanHandle) {
      setError(fr.social.errors.handle_required);
      return;
    }
    setSaving(true);
    try {
      await api.updateProfile({
        ...(cleanHandle ? { handle: cleanHandle } : {}),
        display_name: displayName.trim() || null,
        city: city.trim() || null,
        level,
        bio: bio.trim() || null,
        is_public: isPublic,
      });
      await refreshUser();
      Alert.alert(fr.social.saved);
      navigation.goBack();
    } catch (e) {
      setError(socialErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: NOMA_COLORS.background }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Card>
          <Text style={{ fontFamily: FONTS.body, fontSize: 13, lineHeight: 19, color: NOMA_COLORS.textSecondary }}>
            {fr.social.publicProfileIntro}
          </Text>

          <Label text={fr.social.handle} />
          <TextInput value={handle} onChangeText={setHandle} placeholder="amine_runs" autoCapitalize="none" autoCorrect={false} maxLength={31} />
          <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: NOMA_COLORS.textSecondary, marginTop: 4 }}>{fr.social.handleHint}</Text>

          <Label text={fr.social.displayName} />
          <TextInput value={displayName} onChangeText={setDisplayName} maxLength={80} />

          <Label text={fr.social.city} />
          <TextInput value={city} onChangeText={setCity} placeholder="Tunis" maxLength={80} />

          <Label text={fr.social.level} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {LEVELS.map((l) => (
              <Chip key={l} label={fr.social.levels[l]} selected={level === l} onPress={() => setLevel(level === l ? null : l)} />
            ))}
          </View>

          <Label text={fr.social.bio} />
          <TextInput value={bio} onChangeText={setBio} multiline maxLength={500} />
        </Card>

        <Card style={{ marginTop: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <Text style={{ flex: 1, fontFamily: FONTS.bodyMedium, fontSize: 14, color: NOMA_COLORS.text }}>{fr.social.makePublic}</Text>
            <Switch value={isPublic} onValueChange={setIsPublic} accessibilityLabel={fr.social.makePublic} />
          </View>
        </Card>

        {error ? (
          <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 13, color: NOMA_COLORS.danger, marginTop: 16 }}>{error}</Text>
        ) : null}
        <View style={{ marginTop: 20 }}>
          <Button label={fr.social.save} loading={saving} onPress={save} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
