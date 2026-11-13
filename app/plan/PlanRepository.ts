/**
 * Local persistence for planned runs (AsyncStorage). Writes are serialized.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { PlannedRun, sortByDate } from './plannedRuns';

export const PLANNED_RUNS_KEY = 'NOMA_PLANNED_RUNS_V1';

let queue: Promise<unknown> = Promise.resolve();
const serialize = <T>(fn: () => Promise<T>): Promise<T> => {
  const next = queue.then(fn, fn);
  queue = next.catch(() => undefined);
  return next;
};

async function read(): Promise<PlannedRun[]> {
  const raw = await AsyncStorage.getItem(PLANNED_RUNS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PlannedRun[]) : [];
  } catch {
    return [];
  }
}

export const planRepository = {
  list: (): Promise<PlannedRun[]> => serialize(async () => sortByDate(await read())),

  get: (id: string): Promise<PlannedRun | null> =>
    serialize(async () => (await read()).find((r) => r.id === id) ?? null),

  /** Inserts or replaces a run by id. */
  save: (run: PlannedRun): Promise<void> =>
    serialize(async () => {
      const all = await read();
      const idx = all.findIndex((r) => r.id === run.id);
      if (idx >= 0) all[idx] = run;
      else all.push(run);
      await AsyncStorage.setItem(PLANNED_RUNS_KEY, JSON.stringify(all));
    }),

  remove: (id: string): Promise<void> =>
    serialize(async () => {
      const all = await read();
      await AsyncStorage.setItem(PLANNED_RUNS_KEY, JSON.stringify(all.filter((r) => r.id !== id)));
    }),
};
