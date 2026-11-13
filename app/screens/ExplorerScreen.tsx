/**
 * Explorer: choose a start point and route preferences, then request a route.
 * Generation depends on an online service that is not connected yet, so the
 * screen reports that honestly instead of showing invented routes.
 */

import React, { useState } from 'react';
import { Linking, SafeAreaView, ScrollView, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { Button, Card, FONTS, NOMA_COLORS } from '../components/UIComponents';
import { ScreenTitle } from '../components/Blocks';
import { Chip, Field, SystemState } from '../components/System';
import { StartPointMap } from '../components/StartPointMap';
import {
  Coordinate,
  DISTANCE_OPTIONS_KM,
  ReliefPreference,
  RouteGenerationResult,
  RouteShape,
  routeGenerator,
} from '../explorer/RouteGenerationService';

const Label: React.FC<{ children: string }> = ({ children }) => (
  <Text style={{ fontFamily: FONTS.bodySemiBold, fontSize: 13, color: NOMA_COLORS.text, marginBottom: 8, marginTop: 4 }}>
    {children}
  </Text>
);

export const ExplorerScreen: React.FC = () => {
  const [query, setQuery] = useState('');
  const [start, setStart] = useState<Coordinate | null>(null);
  const [startLabel, setStartLabel] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [distance, setDistance] = useState(10);
  const [shape, setShape] = useState<RouteShape>('loop');
  const [relief, setRelief] = useState<ReliefPreference>('flat');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<RouteGenerationResult | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);

  const pick = (c: Coordinate, label: string) => {
    setStart(c);
    setStartLabel(label);
    setResult(null);
  };

  const search = async () => {
    const text = query.trim();
    if (!text) return;
    setSearching(true);
    setSearchError(null);
    try {
      const found = await Location.geocodeAsync(text);
      if (found.length === 0) setSearchError('Aucun lieu trouvé. Essayez une autre adresse ou touchez la carte.');
      else pick({ latitude: found[0].latitude, longitude: found[0].longitude }, text);
    } catch {
      setSearchError("La recherche de lieu est indisponible. Touchez la carte pour choisir un point de départ.");
    } finally {
      setSearching(false);
    }
  };

  const useMyPosition = async () => {
    setSearchError(null);
    setLocationDenied(false);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        setLocationDenied(true);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      pick({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }, 'Ma position');
    } catch {
      setSearchError('Position introuvable pour le moment. Réessayez ou touchez la carte.');
    }
  };

  const generate = async () => {
    if (!start) return;
    setGenerating(true);
    setResult(null);
    try {
      setResult(await routeGenerator.generate({ start, distanceKm: distance, shape, relief }));
    } catch (e) {
      setResult({ status: 'error', message: e instanceof Error ? e.message : 'Erreur inconnue' });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: NOMA_COLORS.background }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <ScreenTitle title="Explorer" subtitle="Trouvez votre prochain parcours" />

        <View style={{ marginTop: 20 }}>
          <Field
            label="Point de départ"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={search}
            returnKeyType="search"
            placeholder="Adresse, quartier, ville…"
            error={searchError}
          />
          <View style={{ flexDirection: 'row', gap: 8, marginTop: -8, marginBottom: 12 }}>
            <Button label="Rechercher" size="small" variant="secondary" loading={searching} onPress={search} style={{ flex: 1 }} />
            <Button label="Ma position" size="small" variant="secondary" onPress={useMyPosition} style={{ flex: 1 }} />
          </View>
          {locationDenied && (
            <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: NOMA_COLORS.textSecondary, marginBottom: 10 }}>
              Localisation refusée. Cherchez une adresse, touchez la carte, ou{' '}
              <Text style={{ textDecorationLine: 'underline' }} onPress={() => Linking.openSettings()}>
                ouvrez les réglages
              </Text>
              .
            </Text>
          )}
          <StartPointMap value={start} onChange={(c) => pick(c, 'Point choisi sur la carte')} />
          <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: NOMA_COLORS.textSecondary, marginTop: 8 }}>
            {startLabel ? `Départ : ${startLabel}` : 'Touchez la carte pour choisir un départ.'}
          </Text>
        </View>

        <Card style={{ marginTop: 20 }}>
          <Label>Distance</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {DISTANCE_OPTIONS_KM.map((d) => (
              <Chip key={d} label={`${d} km`} selected={distance === d} onPress={() => setDistance(d)} />
            ))}
          </View>
          <Label>Type de parcours</Label>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
            <Chip label="Boucle" selected={shape === 'loop'} onPress={() => setShape('loop')} />
            <Chip label="Aller-retour" selected={shape === 'out-and-back'} onPress={() => setShape('out-and-back')} />
          </View>
          <Label>Relief</Label>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Chip label="Plutôt plat" selected={relief === 'flat'} onPress={() => setRelief('flat')} />
            <Chip label="Vallonné" selected={relief === 'hilly'} onPress={() => setRelief('hilly')} />
          </View>
        </Card>

        <Button
          label="Générer un parcours"
          size="large"
          disabled={!start}
          loading={generating}
          onPress={generate}
          style={{ marginTop: 20 }}
        />
        {!start && (
          <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: NOMA_COLORS.textSecondary, marginTop: 8, textAlign: 'center' }}>
            Choisissez d'abord un point de départ.
          </Text>
        )}

        {result?.status === 'unavailable' && (
          <SystemState
            icon="wifi-off"
            title="Service indisponible"
            message="La génération de parcours n'est pas encore connectée. Vos choix ne sont pas perdus : réessayez plus tard."
            actionLabel="Réessayer"
            onAction={generate}
          />
        )}
        {result?.status === 'no-result' && (
          <SystemState
            icon="search"
            title="Aucun parcours trouvé"
            message="Essayez une autre distance, un autre type de parcours ou un autre point de départ."
          />
        )}
        {result?.status === 'error' && (
          <SystemState
            icon="alert"
            tone="error"
            title="La génération a échoué"
            message={result.message}
            actionLabel="Réessayer"
            onAction={generate}
          />
        )}
        {result?.status === 'ok' &&
          result.routes.map((r) => (
            <Card key={r.id} style={{ marginTop: 16 }}>
              <Text style={{ fontFamily: FONTS.headingBold, fontSize: 20, color: NOMA_COLORS.text }}>
                {r.distanceKm.toFixed(1)} km
              </Text>
              <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: NOMA_COLORS.textSecondary }}>
                Dénivelé estimé : {Math.round(r.elevationGainM)} m
              </Text>
            </Card>
          ))}
      </ScrollView>
    </SafeAreaView>
  );
};
