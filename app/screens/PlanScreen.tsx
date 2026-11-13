/**
 * Plan: upcoming planned runs grouped by day, with local reminders.
 */

import React, { useCallback, useState } from 'react';
import { Alert, Linking, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Badge, Button, Card, FONTS, NOMA_COLORS } from '../components/UIComponents';
import { ScreenTitle, SectionTitle } from '../components/Blocks';
import { Skeleton, SystemState } from '../components/System';
import { planRepository } from '../plan/PlanRepository';
import { reminderService, ReminderPermission } from '../plan/ReminderService';
import { groupByDay, PlannedRun, REMINDER_OPTIONS, splitRuns } from '../plan/plannedRuns';

const reminderLabel = (minutes: number | null) =>
  REMINDER_OPTIONS.find((o) => o.minutes === minutes)?.label ?? null;

const RunCard: React.FC<{
  run: PlannedRun;
  past?: boolean;
  onEdit: () => void;
  onToggleDone: () => void;
  onDelete: () => void;
}> = ({ run, past, onEdit, onToggleDone, onDelete }) => {
  const reminder = reminderLabel(run.reminderMinutes);
  return (
    <Card style={{ marginBottom: 12 }} onPress={onEdit}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={{ fontFamily: FONTS.headingBold, fontSize: 22, color: NOMA_COLORS.text }}>
            {format(run.startsAt, 'HH:mm')}
          </Text>
          <Text style={{ fontFamily: FONTS.heading, fontSize: 16, color: NOMA_COLORS.text, marginTop: 2 }}>{run.title}</Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: NOMA_COLORS.textSecondary, marginTop: 4 }}>
            {run.distanceKm ? `${run.distanceKm} km` : 'Distance libre'}
            {reminder && run.reminderMinutes !== null ? ` · Rappel : ${reminder.toLowerCase()}` : ''}
          </Text>
        </View>
        {past ? <Badge label={run.completed ? 'Terminée' : 'Passée'} variant={run.completed ? 'success' : 'neutral'} /> : null}
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        <Button
          label={run.completed ? 'Marquer à faire' : 'Marquer faite'}
          size="small"
          variant="secondary"
          onPress={onToggleDone}
          style={{ flex: 1 }}
        />
        <Button label="Supprimer" size="small" variant="secondary" onPress={onDelete} style={{ flex: 1 }} />
      </View>
    </Card>
  );
};

export const PlanScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [runs, setRuns] = useState<PlannedRun[] | null>(null);
  const [error, setError] = useState(false);
  const [permission, setPermission] = useState<ReminderPermission>('undetermined');

  const load = useCallback(async () => {
    try {
      setError(false);
      setRuns(await planRepository.list());
      setPermission(await reminderService.getPermission());
    } catch {
      setError(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const toggleDone = async (run: PlannedRun) => {
    await planRepository.save({ ...run, completed: !run.completed });
    load();
  };

  const confirmDelete = (run: PlannedRun) => {
    Alert.alert('Supprimer cette sortie ?', run.title, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          await reminderService.cancel(run.notificationId);
          await planRepository.remove(run.id);
          load();
        },
      },
    ]);
  };

  const edit = (run?: PlannedRun) => navigation.navigate('PlanEdit', { id: run?.id });

  const { upcoming, past } = splitRuns(runs ?? []);
  const needsPermission = upcoming.some((r) => r.reminderMinutes !== null) && permission !== 'granted';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: NOMA_COLORS.background }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <ScreenTitle title="Plan" subtitle="Vos sorties à venir" />

        <Button label="Planifier une sortie" size="large" onPress={() => edit()} style={{ marginTop: 20 }} />

        {error ? (
          <SystemState
            icon="alert"
            tone="error"
            title="Impossible de charger le plan"
            message="Vos sorties planifiées n'ont pas pu être lues."
            actionLabel="Réessayer"
            onAction={load}
          />
        ) : runs === null ? (
          <View style={{ marginTop: 24, gap: 12 }}>
            <Skeleton height={90} />
            <Skeleton height={90} />
          </View>
        ) : (
          <>
            {needsPermission && (
              <Card style={{ marginTop: 16, borderColor: NOMA_COLORS.warning }}>
                <Text style={{ fontFamily: FONTS.bodySemiBold, fontSize: 14, color: NOMA_COLORS.text }}>
                  Rappels désactivés
                </Text>
                <Text style={{ fontFamily: FONTS.body, fontSize: 13, lineHeight: 19, color: NOMA_COLORS.textSecondary, marginTop: 4 }}>
                  Les notifications ne sont pas autorisées : vos rappels ne sonneront pas.
                </Text>
                <Button
                  label={permission === 'denied' ? 'Ouvrir les réglages' : 'Autoriser les notifications'}
                  size="small"
                  variant="secondary"
                  style={{ marginTop: 10 }}
                  onPress={async () =>
                    permission === 'denied' ? Linking.openSettings() : setPermission(await reminderService.requestPermission())
                  }
                />
              </Card>
            )}

            {upcoming.length === 0 ? (
              <SystemState
                icon="calendar"
                title="Aucune sortie planifiée"
                message="Planifiez votre prochaine sortie et recevez un rappel."
              />
            ) : (
              groupByDay(upcoming).map((group) => (
                <View key={group.key} style={{ marginTop: 24 }}>
                  <SectionTitle title={format(group.date, 'EEEE d MMMM', { locale: fr })} />
                  {group.runs.map((run) => (
                    <RunCard
                      key={run.id}
                      run={run}
                      onEdit={() => edit(run)}
                      onToggleDone={() => toggleDone(run)}
                      onDelete={() => confirmDelete(run)}
                    />
                  ))}
                </View>
              ))
            )}

            {past.length > 0 && (
              <View style={{ marginTop: 28 }}>
                <SectionTitle title="Passées" />
                {past.slice(0, 5).map((run) => (
                  <RunCard
                    key={run.id}
                    run={run}
                    past
                    onEdit={() => edit(run)}
                    onToggleDone={() => toggleDone(run)}
                    onDelete={() => confirmDelete(run)}
                  />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};
