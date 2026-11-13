/**
 * Reference activity metrics (version metrics-m1). Pure functions, no I/O.
 *
 * One definition per metric, shared by every screen:
 * - distance: cleaned track distance (prepareTrack), never rounded, no distance across GPS gaps;
 * - elapsed time: end minus start;
 * - paused time: only when pauses were recorded, otherwise unknown (null), never guessed;
 * - interruptions: silences longer than 30 s in the trace (pause or GPS loss, not distinguishable);
 * - moving time: intervals where the cleaned track moves at >= 0.5 m/s;
 * - average pace: moving time / distance (null when too little data);
 * - elevation: median-filtered altitude with a 3 m hysteresis, null without enough altitude data;
 * - max speed: distance over a >= 5 s window on the cleaned track (not the raw GPS speed).
 *
 * The cleaning itself (prepareTrack) is shared with the PR / segment engines and is not changed here.
 */

import { Activity } from '../types';
import { MAX_GAP_MS, prepareTrack } from './track';

export const METRICS_VERSION = 'metrics-m1';

/** An interval below this speed (m/s) is considered stopped. */
export const MOVING_SPEED_MS = 0.5;
/** Minimum altitude change (m) that counts as climb or descent. */
export const ELEVATION_HYSTERESIS_M = 3;
/** Share of track samples that must carry an altitude for elevation to be reported. */
export const MIN_ALTITUDE_COVERAGE = 0.8;
/** Max speed is measured over at least this window. */
export const MAX_SPEED_WINDOW_MS = 5000;
/** Below this moving time the max speed is not reported. */
export const MIN_MOVING_FOR_MAX_SPEED_MS = 60_000;
/** Average pace / speed are not reported below these values. */
export const MIN_PACE_DISTANCE_M = 100;
export const MIN_PACE_MOVING_MS = 30_000;
/** Silence left over after subtracting a recorded pause is ignored below this (GPS stop/start latency). */
export const PAUSE_MATCH_TOLERANCE_MS = 10_000;

export interface PauseInterval {
  start: number;
  /** null while the pause is still open (closed at the end of the activity). */
  end: number | null;
}

export interface Interruption {
  start: number;
  end: number;
  durationMs: number;
}

export interface ActivityMetrics {
  version: string;
  distanceM: number;
  elapsedMs: number;
  /** null when pauses were not recorded (activities saved before this feature). */
  pausedMs: number | null;
  /** Trace silences > 30 s that are not covered by a recorded pause. */
  interruptionMs: number;
  interruptionCount: number;
  movingMs: number;
  stoppedMs: number;
  elevationGainM: number | null;
  elevationLossM: number | null;
  maxSpeedKmh: number | null;
  avgPaceMinKm: number | null;
  avgSpeedKmh: number | null;
  pointCount: number;
  discardedPoints: number;
}

type MetricsInput = Pick<Activity, 'gpsPoints' | 'startTime' | 'endTime' | 'stats'> & {
  pauses?: PauseInterval[];
};

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Gain and loss with a median filter then hysteresis. Null when altitude data is insufficient. */
export function elevationChange(
  altitudes: Array<number | null>,
  threshold = ELEVATION_HYSTERESIS_M
): { gain: number; loss: number } | null {
  const known = altitudes.filter((a): a is number => a !== null && Number.isFinite(a));
  if (known.length < 5 || known.length / Math.max(1, altitudes.length) < MIN_ALTITUDE_COVERAGE) return null;

  const half = 2;
  const smooth = known.map((_, i) => median(known.slice(Math.max(0, i - half), Math.min(known.length, i + half + 1))));

  let gain = 0;
  let loss = 0;
  let ref = smooth[0];
  for (let i = 1; i < smooth.length; i++) {
    const a = smooth[i];
    if (a - ref >= threshold) {
      gain += a - ref;
      ref = a;
    } else if (ref - a >= threshold) {
      loss += ref - a;
      ref = a;
    }
  }
  return { gain, loss };
}

function overlap(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}

/** Pauses clamped to the activity and merged so that overlapping intervals are counted once. */
function normalizePauses(pauses: PauseInterval[], start: number, end: number): Array<[number, number]> {
  const clamped = pauses
    .map((p) => [Math.max(start, p.start), Math.min(end, p.end ?? end)] as [number, number])
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const interval of clamped) {
    const last = merged[merged.length - 1];
    if (last && interval[0] <= last[1]) last[1] = Math.max(last[1], interval[1]);
    else merged.push([interval[0], interval[1]]);
  }
  return merged;
}

export function computeActivityMetrics(activity: MetricsInput): ActivityMetrics {
  const track = prepareTrack(activity.gpsPoints ?? []);
  const { samples } = track;
  const endTime = activity.endTime ?? activity.startTime + activity.stats.totalDuration;
  const elapsedMs = Math.max(0, endTime - activity.startTime);

  // Moving time and silences, from consecutive cleaned samples.
  let movingMs = 0;
  const silences: Interruption[] = [];
  for (let i = 1; i < samples.length; i++) {
    const dt = samples[i].t - samples[i - 1].t;
    if (dt > MAX_GAP_MS) {
      silences.push({ start: samples[i - 1].t, end: samples[i].t, durationMs: dt });
      continue;
    }
    if (dt <= 0) continue;
    const speed = (samples[i].d - samples[i - 1].d) / (dt / 1000);
    if (speed >= MOVING_SPEED_MS) movingMs += dt;
  }

  // Recorded pauses explain some silences; only the rest are reported as interruptions.
  let pausedMs: number | null = null;
  let interruptionMs = 0;
  let interruptionCount = 0;
  const pauses = activity.pauses ? normalizePauses(activity.pauses, activity.startTime, endTime) : null;
  if (pauses) pausedMs = pauses.reduce((s, [a, b]) => s + (b - a), 0);
  for (const silence of silences) {
    const covered = pauses
      ? pauses.reduce((s, [a, b]) => s + overlap(silence.start, silence.end, a, b), 0)
      : 0;
    const remaining = silence.durationMs - covered;
    if (remaining > (pauses ? PAUSE_MATCH_TOLERANCE_MS : 0)) {
      interruptionMs += remaining;
      interruptionCount += 1;
    }
  }

  const stoppedMs = Math.max(0, elapsedMs - (pausedMs ?? 0) - interruptionMs - movingMs);

  // Max speed over >= 5 s windows inside continuous runs.
  let maxSpeedMs = 0;
  for (const [lo, hi] of track.runs) {
    let j = lo;
    for (let i = lo; i < hi; i++) {
      if (j <= i) j = i + 1;
      while (j < hi && samples[j].t - samples[i].t < MAX_SPEED_WINDOW_MS) j++;
      const dt = samples[j].t - samples[i].t;
      if (dt >= MAX_SPEED_WINDOW_MS) {
        maxSpeedMs = Math.max(maxSpeedMs, (samples[j].d - samples[i].d) / (dt / 1000));
      }
    }
  }

  const elevation = elevationChange(samples.map((s) => s.alt));
  const distanceM = track.totalDistance;
  const enoughForPace = distanceM >= MIN_PACE_DISTANCE_M && movingMs >= MIN_PACE_MOVING_MS;

  return {
    version: METRICS_VERSION,
    distanceM,
    elapsedMs,
    pausedMs,
    interruptionMs,
    interruptionCount,
    movingMs,
    stoppedMs,
    elevationGainM: elevation ? elevation.gain : null,
    elevationLossM: elevation ? elevation.loss : null,
    maxSpeedKmh: movingMs >= MIN_MOVING_FOR_MAX_SPEED_MS && maxSpeedMs > 0 ? maxSpeedMs * 3.6 : null,
    avgPaceMinKm: enoughForPace ? movingMs / 60000 / (distanceM / 1000) : null,
    avgSpeedKmh: enoughForPace ? (distanceM / (movingMs / 1000)) * 3.6 : null,
    pointCount: samples.length,
    discardedPoints: track.discardedPoints,
  };
}

/** Compact per-activity record used by every list, aggregate and chart. */
export interface ActivitySummary extends ActivityMetrics {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
  /** 'trace' = computed from GPS points, 'stored' = fallback on the stats saved with the activity. */
  source: 'trace' | 'stored';
}

/**
 * Summary of a finished activity. When the trace is unusable but the activity carries its own stats,
 * those are used and flagged `source: 'stored'` so the UI can say so.
 */
export function buildActivitySummary(activity: Activity): ActivitySummary | null {
  if (activity.status !== 'finished') return null;
  const endTime = activity.endTime ?? activity.startTime + activity.stats.totalDuration;
  const metrics = computeActivityMetrics(activity);
  const base = { id: activity.id, name: activity.name, startTime: activity.startTime, endTime };

  if (metrics.pointCount >= 2) return { ...base, ...metrics, source: 'trace' };

  const s = activity.stats;
  if (!(s.totalDistance > 0)) return { ...base, ...metrics, source: 'trace' };
  const distanceM = s.totalDistance * 1000;
  const movingMs = s.movingTime;
  const enough = distanceM >= MIN_PACE_DISTANCE_M && movingMs >= MIN_PACE_MOVING_MS;
  return {
    ...base,
    ...metrics,
    distanceM,
    movingMs,
    stoppedMs: Math.max(0, metrics.elapsedMs - movingMs),
    elevationGainM: null,
    elevationLossM: null,
    maxSpeedKmh: null,
    avgPaceMinKm: enough ? movingMs / 60000 / s.totalDistance : null,
    avgSpeedKmh: enough ? (distanceM / (movingMs / 1000)) * 3.6 : null,
    source: 'stored',
  };
}
