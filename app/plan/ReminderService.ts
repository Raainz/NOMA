/**
 * Local reminders (expo-notifications). Never throws: failures return a status
 * so the UI can show an honest message.
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { PlannedRun, reminderDate } from './plannedRuns';

export type ReminderPermission = 'granted' | 'denied' | 'undetermined';

const CHANNEL_ID = 'planned-runs';
let configured = false;

function configure() {
  if (configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Rappels de sorties',
      importance: Notifications.AndroidImportance.DEFAULT,
    }).catch(() => undefined);
  }
}

export const reminderService = {
  async getPermission(): Promise<ReminderPermission> {
    try {
      configure();
      const p = await Notifications.getPermissionsAsync();
      return p.granted ? 'granted' : p.canAskAgain ? 'undetermined' : 'denied';
    } catch {
      return 'denied';
    }
  },

  async requestPermission(): Promise<ReminderPermission> {
    try {
      configure();
      const p = await Notifications.requestPermissionsAsync();
      return p.granted ? 'granted' : 'denied';
    } catch {
      return 'denied';
    }
  },

  /** Schedules the reminder for a run. Returns the notification id, or null if nothing was scheduled. */
  async schedule(run: PlannedRun): Promise<string | null> {
    const at = reminderDate(run);
    if (!at) return null;
    try {
      configure();
      return await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Sortie running prévue',
          body: run.distanceKm ? `${run.title} · ${run.distanceKm} km` : run.title,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: at,
          channelId: CHANNEL_ID,
        },
      });
    } catch {
      return null;
    }
  },

  async cancel(notificationId: string | null): Promise<void> {
    if (!notificationId) return;
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch {
      // Already fired or removed.
    }
  },
};
