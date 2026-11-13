/**
 * Personal Records engine (pure, no I/O).
 *
 * After an activity is finalized, `analyzeActivity` computes exact-distance best
 * efforts, compares them with the record history, and returns an updated store
 * plus the new records / achievements. The history is append-only: a beaten
 * record is never overwritten, it stays in the history as the "previous" value.
 */

import { Activity } from '../types';
import { prepareTrack } from './track';
import { bestEffort } from './efforts';

export interface PRDistance {
  key: string;
  meters: number;
  label: string;
}

export const PR_DISTANCES: PRDistance[] = [
  { key: '1k', meters: 1000, label: '1 km' },
  { key: '1mi', meters: 1609.344, label: '1 mile' },
  { key: '3k', meters: 3000, label: '3 km' },
  { key: '5k', meters: 5000, label: '5 km' },
  { key: '10k', meters: 10000, label: '10 km' },
  { key: 'half', meters: 21097.5, label: 'Half marathon' },
  { key: 'marathon', meters: 42195, label: 'Marathon' },
];

export const LONGEST_KEY = 'longest_activity';
/** Minimum improvement (meters) to count a new "longest activity". */
const LONGEST_MIN_IMPROVEMENT_M = 1;
/** Activities shorter than this (meters) of valid GPS are too small to analyze. */
const MIN_ANALYZABLE_DISTANCE_M = 100;

export type RecordKind = 'best_time' | 'longest_activity';

export interface RecordEntry {
  id: string; // `${recordKey}:${activityId}`
  recordKey: string; // `best_1k`, ..., `longest_activity`
  kind: RecordKind;
  /** best_time: duration in ms. longest_activity: distance in meters. */
  value: number;
  activityId: string;
  achievedAt: number;
  previousValue: number | null;
  previousActivityId: string | null;
  /** Positive = improvement (ms faster / meters longer). Null for the first entry. */
  improvement: number | null;
}

export type AchievementType = 'personal_record' | 'first_effort' | 'longest_activity';

export interface Achievement {
  id: string;
  type: AchievementType;
  title: string;
  description: string;
  recordKey: string;
  activityId: string;
  achievedAt: number;
  value: number;
}

export interface PersonalRecordsStore {
  version: 1;
  processedActivityIds: string[];
  history: RecordEntry[];
  achievements: Achievement[];
}

export type SkipReason = 'already_processed' | 'not_finished' | 'insufficient_data';

export interface PRAnalysisResult {
  store: PersonalRecordsStore;
  /** Entries added by this analysis (first efforts and beaten records). */
  newRecords: RecordEntry[];
  achievements: Achievement[];
  skipped?: SkipReason;
}

export function emptyRecordsStore(): PersonalRecordsStore {
  return { version: 1, processedActivityIds: [], history: [], achievements: [] };
}

export function currentRecords(store: PersonalRecordsStore): Record<string, RecordEntry> {
  const out: Record<string, RecordEntry> = {};
  for (const entry of store.history) {
    const existing = out[entry.recordKey];
    // History is chronological; keep the latest entry per key.
    if (!existing || entry.achievedAt >= existing.achievedAt) out[entry.recordKey] = entry;
  }
  return out;
}

export function recordHistory(store: PersonalRecordsStore, recordKey: string): RecordEntry[] {
  return store.history
    .filter((e) => e.recordKey === recordKey)
    .sort((a, b) => a.achievedAt - b.achievedAt);
}

export function formatRecordTime(ms: number): string {
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function analyzeActivity(activity: Activity, store: PersonalRecordsStore): PRAnalysisResult {
  const unchanged = (skipped: SkipReason): PRAnalysisResult => ({
    store,
    newRecords: [],
    achievements: [],
    skipped,
  });

  if (store.processedActivityIds.includes(activity.id)) return unchanged('already_processed');
  if (activity.status !== 'finished') return unchanged('not_finished');

  const markProcessed = (): PersonalRecordsStore => ({
    ...store,
    processedActivityIds: [...store.processedActivityIds, activity.id],
  });

  const track = prepareTrack(activity.gpsPoints ?? []);
  if (track.samples.length < 2 || track.totalDistance < MIN_ANALYZABLE_DISTANCE_M) {
    return { store: markProcessed(), newRecords: [], achievements: [], skipped: 'insufficient_data' };
  }

  const achievedAt = activity.endTime ?? activity.startTime;
  const current = currentRecords(store);
  const newRecords: RecordEntry[] = [];
  const achievements: Achievement[] = [];

  const alreadyHas = (recordKey: string) =>
    store.history.some((e) => e.recordKey === recordKey && e.activityId === activity.id);

  for (const dist of PR_DISTANCES) {
    if (track.totalDistance < dist.meters) continue;
    const recordKey = `best_${dist.key}`;
    if (alreadyHas(recordKey)) continue;

    const effort = bestEffort(track, dist.meters);
    if (!effort) continue;

    const prev = current[recordKey];
    if (prev && effort.durationMs >= prev.value) continue;

    const entry: RecordEntry = {
      id: `${recordKey}:${activity.id}`,
      recordKey,
      kind: 'best_time',
      value: effort.durationMs,
      activityId: activity.id,
      achievedAt,
      previousValue: prev ? prev.value : null,
      previousActivityId: prev ? prev.activityId : null,
      improvement: prev ? prev.value - effort.durationMs : null,
    };
    newRecords.push(entry);
    achievements.push(
      prev
        ? {
            id: `ach:${entry.id}`,
            type: 'personal_record',
            title: `New ${dist.label} PR`,
            description: `${formatRecordTime(effort.durationMs)} - ${formatRecordTime(entry.improvement as number)} faster than before`,
            recordKey,
            activityId: activity.id,
            achievedAt,
            value: effort.durationMs,
          }
        : {
            id: `ach:${entry.id}`,
            type: 'first_effort',
            title: `First ${dist.label}`,
            description: `${formatRecordTime(effort.durationMs)} - your first recorded ${dist.label}`,
            recordKey,
            activityId: activity.id,
            achievedAt,
            value: effort.durationMs,
          }
    );
  }

  // Longest activity (total valid distance)
  const distanceM = Math.round(track.totalDistance * 10) / 10;
  const prevLongest = current[LONGEST_KEY];
  if (!alreadyHas(LONGEST_KEY) && (!prevLongest || distanceM >= prevLongest.value + LONGEST_MIN_IMPROVEMENT_M)) {
    const entry: RecordEntry = {
      id: `${LONGEST_KEY}:${activity.id}`,
      recordKey: LONGEST_KEY,
      kind: 'longest_activity',
      value: distanceM,
      activityId: activity.id,
      achievedAt,
      previousValue: prevLongest ? prevLongest.value : null,
      previousActivityId: prevLongest ? prevLongest.activityId : null,
      improvement: prevLongest ? distanceM - prevLongest.value : null,
    };
    newRecords.push(entry);
    if (prevLongest) {
      achievements.push({
        id: `ach:${entry.id}`,
        type: 'longest_activity',
        title: 'Longest activity',
        description: `${(distanceM / 1000).toFixed(2)} km - ${((entry.improvement as number) / 1000).toFixed(2)} km further than before`,
        recordKey: LONGEST_KEY,
        activityId: activity.id,
        achievedAt,
        value: distanceM,
      });
    }
  }

  return {
    store: {
      ...store,
      processedActivityIds: [...store.processedActivityIds, activity.id],
      history: [...store.history, ...newRecords],
      achievements: [...store.achievements, ...achievements],
    },
    newRecords,
    achievements,
  };
}
