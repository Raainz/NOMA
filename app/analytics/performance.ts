/**
 * Performance analytics (pure, no I/O): volume per period, progression, frequency and filters.
 * Only real finished activities are used; nothing is estimated or mocked.
 *
 * Inputs are normalized by `toPerf`: activity summaries (the normal case, see summaryIndex.ts) or full
 * activities (computed through the reference metrics). Pace and duration use MOVING time everywhere.
 */

import { Activity } from '../types';
import { ActivitySummary, buildActivitySummary } from './metrics';

const MIN_DISTANCE_KM = 0.1;

/** Minimal data the aggregates need. */
export interface PerfActivity {
  id: string;
  startTime: number;
  distanceKm: number;
  /** Moving time (ms): basis of every pace. */
  movingMs: number;
  elapsedMs: number;
}

export type PerfInput = Activity | ActivitySummary | PerfActivity;

export function toPerf(input: PerfInput): PerfActivity | null {
  if ('gpsPoints' in input) {
    const summary = buildActivitySummary(input);
    return summary ? toPerf(summary) : null;
  }
  if ('distanceM' in input) {
    return {
      id: input.id,
      startTime: input.startTime,
      distanceKm: input.distanceM / 1000,
      movingMs: input.movingMs,
      elapsedMs: input.elapsedMs,
    };
  }
  return input;
}

export interface PeriodSummary {
  count: number;
  distanceKm: number;
  /** Total moving time (ms). */
  durationMs: number;
  /** Total elapsed time (ms), pauses and stops included. */
  elapsedMs: number;
  /** min/km over the whole period (moving time / distance), null when there is no distance. */
  avgPaceMinKm: number | null;
}

export interface Bucket extends PeriodSummary {
  /** Start of the period (ms, local time). */
  start: number;
  end: number;
}

export interface Delta {
  current: number | null;
  previous: number | null;
  /** Percent change vs previous, null when previous is 0/unknown. */
  percent: number | null;
}

export interface PeriodComparison {
  distance: Delta;
  duration: Delta;
  count: Delta;
  /** For pace, a negative percent is an improvement (faster). */
  pace: Delta;
}

const isValid = (p: PerfActivity) => p.distanceKm >= MIN_DISTANCE_KM && p.movingMs > 0;

/** Valid, normalized activities (finished, at least 100 m and some moving time). */
export function validActivities(inputs: PerfInput[]): PerfActivity[] {
  const out: PerfActivity[] = [];
  for (const input of inputs) {
    const p = toPerf(input);
    if (p && isValid(p)) out.push(p);
  }
  return out;
}

export function summarize(inputs: PerfInput[]): PeriodSummary {
  const valid = validActivities(inputs);
  const distanceKm = valid.reduce((s, a) => s + a.distanceKm, 0);
  const durationMs = valid.reduce((s, a) => s + a.movingMs, 0);
  const elapsedMs = valid.reduce((s, a) => s + a.elapsedMs, 0);
  return {
    count: valid.length,
    distanceKm,
    durationMs,
    elapsedMs,
    avgPaceMinKm: distanceKm > 0 ? durationMs / 60000 / distanceKm : null,
  };
}

/** Local midnight of the day containing `ts`. */
export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Monday 00:00 (local) of the week containing `ts`. */
export function startOfWeek(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  return d.getTime();
}

export function startOfMonth(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(1);
  return d.getTime();
}

export function startOfYear(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setMonth(0, 1);
  return d.getTime();
}

export const addDays = (ts: number, days: number): number => {
  const d = new Date(ts);
  d.setDate(d.getDate() + days);
  return d.getTime();
};
export const addMonths = (ts: number, months: number): number => {
  const d = new Date(ts);
  d.setMonth(d.getMonth() + months);
  return d.getTime();
};

/** Items whose start time lies in [start, end). */
export function inRange<T extends PerfInput>(items: T[], start: number, end: number): T[] {
  return items.filter((a) => a.startTime >= start && a.startTime < end);
}

/** Last `weeks` weeks, oldest first, ending with the week of `now`. */
export function weeklyBuckets(items: PerfInput[], now: number, weeks = 8): Bucket[] {
  const thisWeek = startOfWeek(now);
  const out: Bucket[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = addDays(thisWeek, -7 * i);
    const end = addDays(start, 7);
    out.push({ start, end, ...summarize(inRange(items, start, end)) });
  }
  return out;
}

/** Last `months` calendar months, oldest first, ending with the month of `now`. */
export function monthlyBuckets(items: PerfInput[], now: number, months = 6): Bucket[] {
  const thisMonth = startOfMonth(now);
  const out: Bucket[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const start = addMonths(thisMonth, -i);
    const end = addMonths(start, 1);
    out.push({ start, end, ...summarize(inRange(items, start, end)) });
  }
  return out;
}

const delta = (current: number | null, previous: number | null): Delta => ({
  current,
  previous,
  percent: current !== null && previous !== null && previous !== 0 ? ((current - previous) / previous) * 100 : null,
});

export function comparePeriods(current: PeriodSummary, previous: PeriodSummary): PeriodComparison {
  return {
    distance: delta(current.distanceKm, previous.distanceKm),
    duration: delta(current.durationMs, previous.durationMs),
    count: delta(current.count, previous.count),
    pace: delta(current.avgPaceMinKm, previous.avgPaceMinKm),
  };
}

export interface SeriesPoint {
  time: number;
  value: number;
  activityId: string;
}

export function distanceSeries(items: PerfInput[]): SeriesPoint[] {
  return validActivities(items)
    .sort((a, b) => a.startTime - b.startTime)
    .map((a) => ({ time: a.startTime, value: a.distanceKm, activityId: a.id }));
}

/** Average pace (min/km, moving time) per activity. */
export function paceSeries(items: PerfInput[]): SeriesPoint[] {
  return validActivities(items)
    .sort((a, b) => a.startTime - b.startTime)
    .map((a) => ({ time: a.startTime, value: a.movingMs / 60000 / a.distanceKm, activityId: a.id }));
}

export interface Frequency {
  weeks: number;
  totalActivities: number;
  activitiesPerWeek: number;
  activeDays: number;
}

export function frequency(items: PerfInput[], now: number, weeks = 8): Frequency {
  const buckets = weeklyBuckets(items, now, weeks);
  const start = buckets[0].start;
  const end = buckets[buckets.length - 1].end;
  const inWindow = validActivities(inRange(items, start, end));
  const days = new Set(inWindow.map((a) => new Date(a.startTime).toDateString()));
  return {
    weeks,
    totalActivities: inWindow.length,
    activitiesPerWeek: inWindow.length / weeks,
    activeDays: days.size,
  };
}

/** Minimum number of valid activities needed before showing trends. */
export const MIN_ACTIVITIES_FOR_TRENDS = 2;

export interface HistoryFilter {
  from?: number | null;
  to?: number | null;
  minKm?: number | null;
  maxKm?: number | null;
}

export function filterActivities<T extends PerfInput>(items: T[], f: HistoryFilter): T[] {
  return items.filter((item) => {
    const p = toPerf(item);
    if (!p) return false;
    if (f.from != null && p.startTime < f.from) return false;
    if (f.to != null && p.startTime >= f.to) return false;
    if (f.minKm != null && p.distanceKm < f.minKm) return false;
    if (f.maxKm != null && p.distanceKm > f.maxKm) return false;
    return true;
  });
}
