/**
 * Background location task (works in development/production builds, not in Expo Go).
 * Must be imported at app entry so the task is defined before tracking starts.
 */

import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';

export const BACKGROUND_TRACKING_TASK = 'NOMA_BACKGROUND_TRACKING';

type LocationsListener = (locations: Location.LocationObject[]) => void;

let listener: LocationsListener | null = null;

export const setBackgroundLocationListener = (fn: LocationsListener | null): void => {
  listener = fn;
};

TaskManager.defineTask(BACKGROUND_TRACKING_TASK, async ({ data, error }) => {
  if (error) {
    console.warn('[BackgroundLocationTask] error:', error.message);
    return;
  }
  const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
  if (locations && locations.length > 0 && listener) {
    listener(locations);
  }
});
