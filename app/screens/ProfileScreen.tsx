/**
 * Profil: account, sync status, real permission state and privacy statement.
 */

import React, { useCallback, useState } from 'react';
import { Alert, Linking, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { Badge, Button, Card, NOMA_COLORS, FONTS } from '../components/UIComponents';
import { ScreenTitle } from '../components/Blocks';
import { useSummaries } from '../hooks/useSummaries';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';

type Perm = 'granted' | 'denied' | 'undetermined';

const Row: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 }}>
    <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 14, color: NOMA_COLORS.text }}>{label}</Text>
    {value}
  </View>
);

export const ProfileScreen: React.FC = () => {
  const [perm, setPerm] = useState<Perm>('undetermined');
  const { summaries } = useSummaries();
  const { user, logout } = useAuth();
  const { counts, syncing, lastError, syncNow, retryFailed } = useSync();

  const confirmLogout = () => {
    const unsynced = counts.pending + counts.failed;
    Alert.alert(
      'Se déconnecter ?',
      unsynced > 0
        ? `${unsynced} activité(s) ne sont pas encore sauvegardées sur le serveur. Elles restent sur ce téléphone mais seront envoyées au prochain compte connecté.`
        : 'Vos activités restent sur ce téléphone.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Se déconnecter', style: 'destructive', onPress: () => logout() },
      ]
    );
  };
  useFocusEffect(
    useCallback(() => {
      Location.getForegroundPermissionsAsync()
        .then((p) => setPerm(p.status as Perm))
        .catch(() => undefined);
    }, [])
  );

  const request = async () => {
    const p = await Location.requestForegroundPermissionsAsync();
    setPerm(p.status as Perm);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: NOMA_COLORS.background }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <ScreenTitle title="Profil" subtitle="Compte et confidentialité" />

        <Card style={{ marginTop: 20 }}>
          <Text style={{ fontFamily: FONTS.heading, fontSize: 17, color: NOMA_COLORS.text }}>Compte</Text>
          <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 15, color: NOMA_COLORS.text, marginTop: 8 }}>
            {user?.display_name || user?.email || 'Connecté'}
          </Text>
          {user?.display_name ? (
            <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: NOMA_COLORS.textSecondary, marginTop: 2 }}>{user.email}</Text>
          ) : null}
          <View style={{ height: 14 }} />
          <Button label="Se déconnecter" size="small" variant="secondary" onPress={confirmLogout} />
        </Card>

        <Card style={{ marginTop: 16 }}>
          <Text style={{ fontFamily: FONTS.heading, fontSize: 17, color: NOMA_COLORS.text }}>Synchronisation</Text>
          <Row label="Sauvegardées" value={<Text style={{ fontFamily: FONTS.bodySemiBold }}>{counts.synced}</Text>} />
          <Row label="En attente" value={<Text style={{ fontFamily: FONTS.bodySemiBold }}>{counts.pending}</Text>} />
          {counts.failed > 0 && (
            <Row label="Échecs" value={<Badge label={String(counts.failed)} variant="danger" />} />
          )}
          {lastError && (
            <Text style={{ fontFamily: FONTS.body, fontSize: 13, lineHeight: 19, color: NOMA_COLORS.textSecondary, marginBottom: 10 }}>
              Dernier problème : {lastError}
            </Text>
          )}
          <Button label="Synchroniser maintenant" size="small" loading={syncing} onPress={syncNow} />
          {counts.failed > 0 && (
            <View style={{ marginTop: 10 }}>
              <Button label="Réessayer les échecs" size="small" variant="secondary" onPress={retryFailed} />
            </View>
          )}
        </Card>

        <Card style={{ marginTop: 16 }}>
          <Text style={{ fontFamily: FONTS.heading, fontSize: 17, color: NOMA_COLORS.text }}>Localisation</Text>
          <Row
            label="Autorisation"
            value={
              <Badge
                label={perm === 'granted' ? 'Autorisée' : perm === 'denied' ? 'Refusée' : 'Non demandée'}
                variant={perm === 'granted' ? 'success' : perm === 'denied' ? 'danger' : 'neutral'}
              />
            }
          />
          {perm === 'undetermined' && <Button label="Autoriser" size="small" onPress={request} />}
          {perm === 'denied' && (
            <>
              <Text style={{ fontFamily: FONTS.body, fontSize: 13, lineHeight: 19, color: NOMA_COLORS.textSecondary, marginBottom: 10 }}>
                Sans localisation, l'enregistrement est impossible. Activez-la dans les réglages du téléphone.
              </Text>
              <Button label="Ouvrir les réglages" size="small" variant="secondary" onPress={() => Linking.openSettings()} />
            </>
          )}
        </Card>

        <Card style={{ marginTop: 16 }}>
          <Text style={{ fontFamily: FONTS.heading, fontSize: 17, color: NOMA_COLORS.text }}>Données</Text>
          <Row label="Activités enregistrées" value={<Text style={{ fontFamily: FONTS.bodySemiBold }}>{summaries.length}</Text>} />
          <Text style={{ fontFamily: FONTS.body, fontSize: 13, lineHeight: 19, color: NOMA_COLORS.textSecondary }}>
            Vos sorties, y compris le tracé GPS, sont enregistrées d'abord sur votre téléphone puis sauvegardées sur votre compte. Elles ne sont visibles que par vous.
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};
