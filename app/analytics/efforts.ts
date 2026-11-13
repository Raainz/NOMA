/**
 * Effort analysis: exact-distance best efforts, kilometer splits and profiles.
 * Pure functions on a prepared Track.
 */

import { Track, TrackSample, valueAtDistance } from './track';

/** Average speeds above this (m/s, ~2:00/km) over an effort are rejected as GPS error. */
export const MAX_EFFORT_SPEED_MS = 8.5;

export interface BestEffort {
  targetMeters: number;
  /** Elapsed time of the effort, rounded to ms. */
  durationMs: number;
  startTime: number;
  endTime: number;
  /** Cumulative track distance where the effort starts (m). */
  startDistance: number;
}

/**
 * Fastest continuous effort covering EXACTLY `targetMeters`, found with a sliding
 * window over every possible start position (at each sample, and at each position
 * where the window ends on a sample). Efforts never span a pause or GPS gap.
 */
export function bestEffort(track: Track, targetMeters: number): BestEffort | null {
  const { samples, runs } = track;
  let best: BestEffort | null = null;

  for (const [lo, hi] of runs) {
    if (hi <= lo) continue;
    const runStart = samples[lo].d;
    const runEnd = samples[hi].d;
    if (runEnd - runStart < targetMeters) continue;

    const consider = (startD: number) => {
      const endD = startD + targetMeters;
      if (startD < runStart - 1e-9 || endD > runEnd + 1e-9) return;
      const t0 = valueAtDistance(samples, lo, hi, startD, 't');
      const t1 = valueAtDistance(samples, lo, hi, endD, 't');
      const duration = t1 - t0;
      if (duration <= 0) return;
      if (targetMeters / (duration / 1000) > MAX_EFFORT_SPEED_MS) return;
      if (!best || duration < best.durationMs) {
        best = {
          targetMeters,
          durationMs: Math.round(duration),
          startTime: Math.round(t0),
          endTime: Math.round(t1),
          startDistance: startD,
        };
      }
    };

    for (let i = lo; i <= hi; i++) {
      consider(samples[i].d); // window starting on a sample
      consider(samples[i].d - targetMeters); // window ending on a sample
    }
  }

  return best;
}

export interface Split {
  index: number; // 1-based
  distanceMeters: number;
  /** Moving time of the split (ms). */
  durationMs: number;
  /** min/km */
  paceMinKm: number;
  elevationGain: number;
  isPartial: boolean;
}

function smoothAltitudes(samples: TrackSample[], window = 5): Array<number | null> {
  const half = Math.floor(window / 2);
  return samples.map((_, i) => {
    let sum = 0;
    let n = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(samples.length - 1, i + half); j++) {
      const a = samples[j].alt;
      if (a !== null) {
        sum += a;
        n++;
      }
    }
    return n > 0 ? sum / n : null;
  });
}

/** Kilometer splits on moving time. The last partial split is kept if >= 100 m. */
export function computeSplits(track: Track, splitMeters = 1000): Split[] {
  const { samples } = track;
  if (samples.length < 2) return [];
  const last = samples.length - 1;
  const total = track.totalDistance;
  const alt = smoothAltitudes(samples);
  const splits: Split[] = [];

  for (let start = 0, idx = 1; start < total - 1e-6; start += splitMeters, idx++) {
    const end = Math.min(start + splitMeters, total);
    const dist = end - start;
    const isPartial = dist < splitMeters - 1e-6;
    if (isPartial && dist < 100) break;

    const m0 = valueAtDistance(samples, 0, last, start, 'm');
    const m1 = valueAtDistance(samples, 0, last, end, 'm');
    const duration = m1 - m0;
    if (duration <= 0) continue;

    let gain = 0;
    let prev: number | null = null;
    for (let i = 0; i <= last; i++) {
      if (samples[i].d < start || samples[i].d > end) continue;
      const a = alt[i];
      if (a !== null && prev !== null && a > prev) gain += a - prev;
      if (a !== null) prev = a;
    }

    splits.push({
      index: idx,
      distanceMeters: dist,
      durationMs: Math.round(duration),
      paceMinKm: duration / 1000 / 60 / (dist / 1000),
      elevationGain: gain,
      isPartial,
    });
  }

  return splits;
}

export interface ElevationPoint {
  distanceMeters: number;
  altitude: number;
}

/** Altitude averaged into `buckets` equal distance slices. Empty if no altitude data. */
export function elevationProfile(track: Track, buckets = 60): ElevationPoint[] {
  const withAlt = track.samples.filter((s) => s.alt !== null);
  if (withAlt.length < 2 || track.totalDistance <= 0) return [];

  const size = track.totalDistance / buckets;
  const sums = new Array<number>(buckets).fill(0);
  const counts = new Array<number>(buckets).fill(0);
  for (const s of withAlt) {
    const b = Math.min(buckets - 1, Math.floor(s.d / size));
    sums[b] += s.alt as number;
    counts[b]++;
  }

  const out: ElevationPoint[] = [];
  let lastAlt: number | null = null;
  for (let b = 0; b < buckets; b++) {
    if (counts[b] > 0) lastAlt = sums[b] / counts[b];
    if (lastAlt !== null) out.push({ distanceMeters: (b + 0.5) * size, altitude: lastAlt });
  }
  return out;
}
