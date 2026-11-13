/**
 * Track preparation for analytics.
 * Cleans raw GPS points (noise, spikes, pauses) into a monotonic track that
 * the PR / split / segment engines can rely on. Pure functions, no I/O.
 * Distances are in meters, times in milliseconds.
 */

import { GPSPoint } from '../types';

/** A gap larger than this between two points is treated as a pause / GPS loss. */
export const MAX_GAP_MS = 30_000;
/** Points less accurate than this (meters) are discarded. */
export const MIN_ACCURACY_M = 50;
/** Implied speeds above this (m/s) between two points are GPS spikes. */
export const MAX_SPEED_MS = 10;
/** After this many consecutive rejected points we re-anchor on the next one. */
const MAX_CONSECUTIVE_DROPS = 5;

export interface TrackSample {
  lat: number;
  lon: number;
  alt: number | null;
  /** Timestamp (ms). */
  t: number;
  /** Cumulative distance along the track (m). Gaps do not add distance. */
  d: number;
  /** Cumulative moving time (ms). Gaps do not add time. */
  m: number;
}

export interface Track {
  samples: TrackSample[];
  /** Continuous index ranges [start, end] (inclusive), split at pauses / GPS gaps. */
  runs: Array<[number, number]>;
  totalDistance: number;
  movingTime: number;
  discardedPoints: number;
}

export function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371008.8;
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function prepareTrack(points: GPSPoint[]): Track {
  const sorted = [...points].sort((a, b) => a.timestamp - b.timestamp);
  const samples: TrackSample[] = [];
  const runs: Array<[number, number]> = [];
  let runStart = 0;
  let discarded = 0;
  let consecutiveDrops = 0;

  for (const p of sorted) {
    if (p.accuracy !== null && p.accuracy > MIN_ACCURACY_M) {
      discarded++;
      continue;
    }

    const last = samples[samples.length - 1];
    if (!last) {
      samples.push({ lat: p.latitude, lon: p.longitude, alt: p.altitude, t: p.timestamp, d: 0, m: 0 });
      continue;
    }

    const dt = p.timestamp - last.t;
    if (dt <= 0) {
      discarded++;
      continue;
    }

    const dist = haversine(last.lat, last.lon, p.latitude, p.longitude);
    const isGap = dt > MAX_GAP_MS;
    const speed = dist / (dt / 1000);

    if (!isGap && speed > MAX_SPEED_MS) {
      consecutiveDrops++;
      discarded++;
      if (consecutiveDrops < MAX_CONSECUTIVE_DROPS) continue;
      // Anchor was probably the outlier: restart a run from this point.
      runs.push([runStart, samples.length - 1]);
      runStart = samples.length;
      samples.push({ lat: p.latitude, lon: p.longitude, alt: p.altitude, t: p.timestamp, d: last.d, m: last.m });
      consecutiveDrops = 0;
      continue;
    }
    consecutiveDrops = 0;

    if (isGap) {
      runs.push([runStart, samples.length - 1]);
      runStart = samples.length;
      samples.push({ lat: p.latitude, lon: p.longitude, alt: p.altitude, t: p.timestamp, d: last.d, m: last.m });
    } else {
      samples.push({
        lat: p.latitude,
        lon: p.longitude,
        alt: p.altitude,
        t: p.timestamp,
        d: last.d + dist,
        m: last.m + dt,
      });
    }
  }

  if (samples.length > 0) runs.push([runStart, samples.length - 1]);

  const end = samples[samples.length - 1];
  return {
    samples,
    runs,
    totalDistance: end ? end.d : 0,
    movingTime: end ? end.m : 0,
    discardedPoints: discarded,
  };
}

/**
 * Interpolates a value (`t` or `m`) at cumulative distance `x`, searching
 * samples[lo..hi]. `x` must lie within [samples[lo].d, samples[hi].d].
 */
export function valueAtDistance(
  samples: TrackSample[],
  lo: number,
  hi: number,
  x: number,
  field: 't' | 'm' | 'lat' | 'lon'
): number {
  if (x <= samples[lo].d) return samples[lo][field];
  if (x >= samples[hi].d) return samples[hi][field];
  // Largest k in [lo, hi] with d[k] <= x
  let a = lo;
  let b = hi;
  while (a < b) {
    const mid = Math.ceil((a + b) / 2);
    if (samples[mid].d <= x) a = mid;
    else b = mid - 1;
  }
  if (a >= hi) return samples[hi][field];
  const s0 = samples[a];
  const s1 = samples[a + 1];
  const span = s1.d - s0.d;
  if (span <= 0) return s0[field];
  return s0[field] + ((x - s0.d) / span) * (s1[field] - s0[field]);
}
