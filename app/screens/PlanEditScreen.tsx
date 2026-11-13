/**
 * Plan: create or edit a planned run (day, time, distance, reminder).
 */

import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Button, FONTS, NOMA_COLORS } from '../components/UIComponents';
import { Chip, Field } from '../components/System';
import { planRepository } from '../plan/PlanRepository';
import { reminderService } from '../plan/ReminderService';
import {
  parseDistance,
  PlannedRun,
  REMINDER_OPTIONS,
  startOfDay,
  validateDraft,
} from '../plan/plannedRuns';

const DAYS_AHEAD = 14;
const pad = (n: number) => String(n).padStart(2, '0');
const Label: React.FC<{ children: string }> = ({ children }) => (
  <Text style={{ fontFamily: FONTS.bodySemiBold, fontSize: 13, color: NOMA_COLORS.text, marginBottom: 8, marginTop: 4 }}>
    {children}
  </Text>
);

export const PlanEditScreen: React.FC<{ route: { params?: { id?: string } }; navigation: any }> = ({ route, navigation }) => {
  const editingId = route.params?.id;
  const today = startOfDay(Date.now());

  const [existing, setExisting] = useState<PlannedRun | null>(null);
  const [title, setTitle] = useState('');
  const [dayOffset, setDayOffset] = useState(1);
  const [minutes, setMinutes] = useState(7 * 60);
  const [distanceText, setDistanceText] = useState('');
  const [reminder, setReminder] = useState<number | null>(60);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: editingId ? 'Modifier la sortie' : 'Nouvelle sortie' });
    if (!editingId) return;
    planRepository.get(editingId).then((run) => {
      if (!run) return;
      setExisting(run);
      setTitle(run.title);
      const day = new Date(run.startsAt);
      const offset = Math.round((startOfDay(run.startsAt) - today) / 86_400_000);
      setDayOffset(Math.min(Math.max(offset, 0), DAYS_AHEAD - 1));
      setMinutes(day.getHours() * 60 + day.getMinutes());
      setDistanceText(run.distanceKm ? String(run.distanceKm) : '');
      setReminder(run.reminderMinutes);
    });
  }, [editingId]); // eslint-disable-line react-hooks/exhaustive-deps

  const shiftTime = (delta: number) => setMinutes((m) => (m + delta + 1440) % 1440);

  const save = async () => {
    const distance = parseDistance(distanceText);
    if (Number.isNaN(distance)) {
      setError('La distance doit être un nombre (ex. 10 ou 10,5).');
      return;
    }
    const startsAt = startOfDay(today, dayOffset) + minutes * 60_000;
    const draft = { title, startsAt, distanceKm: distance, reminderMinutes: reminder };
    const problem = validateDraft(draft);
    if (problem) {
      setError(problem);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (existing) await reminderService.cancel(existing.notificationId);

      const run: PlannedRun = {
        id: existing?.id ?? `plan_${Date.now()}`,
        title: title.trim(),
        startsAt,
        distanceKm: distance,
        reminderMinutes: reminder,
        notificationId: null,
        completed: existing?.completed ?? false,
        createdAt: existing?.createdAt ?? Date.now(),
      };

      let notice: string | null = null;
      if (reminder !== null) {
        let permission = await reminderService.getPermission();
        if (permission === 'undetermined') permission = await reminderService.requestPermission();
        if (permission === 'granted') {
          run.notificationId = await reminderService.schedule(run);
          if (!run.notificationId) notice = "Le moment du rappel est déjà passé : aucun rappel n'a été programmé.";
        } else {
          notice = "Notifications refusées : la sortie est enregistrée mais le rappel ne sonnera pas.";
        }
      }

      await planRepository.save(run);
      if (notice) Alert.alert('Sortie enregistrée', notice, [{ text: 'OK', onPress: () => navigation.goBack() }]);
      else navigation.goBack();
    } catch {
      setError("Impossible d'enregistrer la sortie. Réessayez.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: NOMA_COLORS.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <Field label="Titre" value={title} onChangeText={setTitle} placeholder="Sortie longue, fractionné…" maxLength={60} />

          <Label>Jour</Label>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
            {Array.from({ length: DAYS_AHEAD }, (_, i) => (
              <Chip
                key={i}
                label={i === 0 ? "Aujourd'hui" : i === 1 ? 'Demain' : format(startOfDay(today, i), 'EEE d', { locale: fr })}
                selected={dayOffset === i}
                onPress={() => setDayOffset(i)}
              />
            ))}
          </ScrollView>

          <Label>Heure</Label>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <Button label="−1 h" size="small" variant="secondary" onPress={() => shiftTime(-60)} />
            <Button label="−15" size="small" variant="secondary" onPress={() => shiftTime(-15)} />
            <Text
              style={{ flex: 1, textAlign: 'center', fontFamily: FONTS.headingBold, fontSize: 28, color: NOMA_COLORS.text }}
              accessibilityLabel={`Heure ${pad(Math.floor(minutes / 60))} heures ${pad(minutes % 60)}`}
            >
              {pad(Math.floor(minutes / 60))}:{pad(minutes % 60)}
            </Text>
            <Button label="+15" size="small" variant="secondary" onPress={() => shiftTime(15)} />
            <Button label="+1 h" size="small" variant="secondary" onPress={() => shiftTime(60)} />
          </View>

          <Field
            label="Distance visée (km, facultatif)"
            value={distanceText}
            onChangeText={setDistanceText}
            keyboardType="decimal-pad"
            placeholder="10"
          />

          <Label>Rappel</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {REMINDER_OPTIONS.map((o) => (
              <Chip key={o.label} label={o.label} selected={reminder === o.minutes} onPress={() => setReminder(o.minutes)} />
            ))}
          </View>

          {error ? (
            <Text accessibilityRole="alert" style={{ fontFamily: FONTS.bodyMedium, fontSize: 13, color: NOMA_COLORS.danger, marginBottom: 12 }}>
              {error}
            </Text>
          ) : null}

          <Button label="Enregistrer" size="large" onPress={save} loading={saving} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
