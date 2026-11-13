/**
 * Personal segment analysis (pure, no I/O).
 *
 * A segment is a route section (>= 400 m) that was travelled, in the same
 * direction, in at least two activities. Attempts are the times achieved on
 * that section in each activity. No public leaderboards: personal only.
 */

import { Activity } from '../types';
import { Track, haversine, prepareTrack, valueAtDistance } from './track';

export const SAMPLE_SPACING_M = 20;
export const MATCH_RADIUS_M = 30;
export const MIN_SEGMENT_M = 400;
export const LENGTH_TOLERANCE = 0.15;
/** Below this speed (m/s) an interval counts as stopped (not moving). */
const MOVING_SPEED_MS = 0.3;

export interface RoutePoint {
  lat: number;
  lon: number;
  /** Cumulative track distance (m). */
  d: number;
  /** Timestamp (ms). */
  t: number;
}

export interface Segment {
  id: string;
  name: string;
  lengthMeters: number;
  /** Resampled geometry [lat, lon] every ~20 m. */
  points: Array<[number, number]>;
  createdFromActivityId: string;
  createdAt: number;
}

export interface SegmentAttempt {
  id: string; // `${segmentId}:${activityId}`
  segmentId: string;
  activityId: string;
  startedAt: number;
  /** Wall-clock time between entering and leaving the segment. */
  elapsedMs: number;
  /** Elapsed time minus stopped intervals. */
  movingMs: number;
  distanceMeters: number;
  paceMinKm: number;
}

export interface SegmentStore {
  version: 1;
  processedActivityIds: string[];
  segments: Segment[];
  attempts: SegmentAttempt[];
}

export interface SegmentPersonalBest {
  segment: Segment;
  attempt: SegmentAttempt;
  previousBestMs: number;
}

export interface SegmentAnalysisResult {
  store: SegmentStore;
  newSegments: Segment[];
  /** Attempts recorded for the analyzed activity. */
  attempts: SegmentAttempt[];
  personalBests: SegmentPersonalBest[];
  skipped?: 'already_processed' | 'not_finished' | 'insufficient_data';
}

export function emptySegmentStore(): SegmentStore {
  return { version: 1, processedActivityIds: [], segments: [], attempts: [] };
}

// ---------------------------------------------------------------------------
// Route resampling
// ---------------------------------------------------------------------------

/** Resamples each continuous run of a track every SAMPLE_SPACING_M meters. */
export function resampleRuns(track: Track, spacing = SAMPLE_SPACING_M): RoutePoint[][] {
  const out: RoutePoint[][] = [];
  const { samples } = track;
  for (const [lo, hi] of track.runs) {
    if (hi <= lo) continue;
    const start = samples[lo].d;
    const length = samples[hi].d - start;
    if (length < spacing) continue;

    const route: RoutePoint[] = [];
    const at = (x: number): RoutePoint => ({
      lat: valueAtDistance(samples, lo, hi, x, 'lat'),
      lon: valueAtDistance(samples, lo, hi, x, 'lon'),
      d: x,
      t: valueAtDistance(samples, lo, hi, x, 't'),
    });
    for (let x = start; x < samples[hi].d; x += spacing) route.push(at(x));
    route.push(at(samples[hi].d));
    out.push(route);
  }
  return out;
}

const dist = (a: { lat: number; lon: number }, lat: number, lon: number) =>
  haversine(a.lat, a.lon, lat, lon);

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

function buildGrid(route: RoutePoint[]): Map<string, number[]> {
  const grid = new Map<string, number[]>();
  route.forEach((p, i) => {
    const key = cellKey(p.lat, p.lon);
    const list = grid.get(key);
    if (list) list.push(i);
    else grid.set(key, [i]);
  });
  return grid;
}

const CELL_DEG = MATCH_RADIUS_M / 111_320;
const cellOf = (lat: number, lon: number): [number, number] => {
  const lonScale = Math.max(0.01, Math.cos((lat * Math.PI) / 180));
  return [Math.floor(lat / CELL_DEG), Math.floor(lon / (CELL_DEG / lonScale))];
};
const cellKey = (lat: number, lon: number) => cellOf(lat, lon).join(':');

function nearestIndex(grid: Map<string, number[]>, route: RoutePoint[], p: RoutePoint): number {
  const [cy, cx] = cellOf(p.lat, p.lon);
  let best = -1;
  let bestDist = MATCH_RADIUS_M;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const list = grid.get(`${cy + dy}:${cx + dx}`);
      if (!list) continue;
      for (const i of list) {
        const d = dist(route[i], p.lat, p.lon);
        if (d <= bestDist) {
          bestDist = d;
          best = i;
        }
      }
    }
  }
  return best;
}

/**
 * Sections of `route` that also appear, in the same direction, in `other`.
 * Short GPS misses (<= 2 samples) are bridged.
 */
function sharedSections(route: RoutePoint[], other: RoutePoint[]): RoutePoint[][] {
  const grid = buildGrid(other);
  const found: RoutePoint[][] = [];
  let start = -1;
  let end = -1;
  let lastH = -1;
  let misses = 0;

  const close = () => {
    if (start >= 0 && route[end].d - route[start].d >= MIN_SEGMENT_M) {
      found.push(route.slice(start, end + 1));
    }
    start = -1;
    end = -1;
    lastH = -1;
    misses = 0;
  };

  for (let a = 0; a < route.length; a++) {
    const h = nearestIndex(grid, other, route[a]);
    const forward = h >= 0 && (lastH === -1 || (h >= lastH && h - lastH <= 6));
    if (forward) {
      if (start < 0) start = a;
      end = a;
      lastH = h;
      misses = 0;
    } else if (start >= 0) {
      if (h >= 0) {
        // Matches `other` but not in the same direction / order: new candidate.
        close();
        start = a;
        end = a;
        lastH = h;
      } else if (++misses > 2) {
        close();
      }
    }
  }
  close();
  return found;
}

const sameSection = (a: Array<[number, number]>, lengthA: number, b: Segment): boolean => {
  const aStart = a[0];
  const aEnd = a[a.length - 1];
  const bStart = b.points[0];
  const bEnd = b.points[b.points.length - 1];
  return (
    haversine(aStart[0], aStart[1], bStart[0], bStart[1]) <= MATCH_RADIUS_M &&
    haversine(aEnd[0], aEnd[1], bEnd[0], bEnd[1]) <= MATCH_RADIUS_M &&
    Math.abs(lengthA - b.lengthMeters) <= LENGTH_TOLERANCE * b.lengthMeters
  );
};

// ---------------------------------------------------------------------------
// Matching attempts
// ---------------------------------------------------------------------------

/** Whether route[a..b] follows the segment geometry (both ways, within radius). */
function follows(segment: Segment, route: RoutePoint[], a: number, b: number): boolean {
  for (const [lat, lon] of segment.points) {
    let ok = false;
    for (let i = a; i <= b; i++) {
      if (dist(route[i], lat, lon) <= MATCH_RADIUS_M) {
        ok = true;
        break;
      }
    }
    if (!ok) return false;
  }
  for (let i = a; i <= b; i++) {
    let ok = false;
    for (const [lat, lon] of segment.points) {
      if (dist(route[i], lat, lon) <= MATCH_RADIUS_M) {
        ok = true;
        break;
      }
    }
    if (!ok) return false;
  }
  return true;
}

function movingMsBetween(track: Track, t0: number, t1: number): number {
  let stopped = 0;
  const s = track.samples;
  for (let i = 1; i < s.length; i++) {
    if (s[i - 1].t < t0 || s[i].t > t1) continue;
    const dt = s[i].t - s[i - 1].t;
    if (dt <= 0 || dt > 30_000) continue;
    if (s[i].d - s[i - 1].d < MOVING_SPEED_MS * (dt / 1000)) stopped += dt;
  }
  return Math.max(0, t1 - t0 - stopped);
}

/** Fastest traversal of `segment` in an activity, or null if not travelled. */
export function findAttempt(
  segment: Segment,
  track: Track,
  runs: RoutePoint[][],
  activityId: string
): SegmentAttempt | null {
  const [sLat, sLon] = segment.points[0];
  const [eLat, eLon] = segment.points[segment.points.length - 1];
  const minLen = segment.lengthMeters * (1 - LENGTH_TOLERANCE);
  const maxLen = segment.lengthMeters * (1 + LENGTH_TOLERANCE);
  let best: SegmentAttempt | null = null;

  for (const route of runs) {
    for (let a = 0; a < route.length; a++) {
      if (dist(route[a], sLat, sLon) > MATCH_RADIUS_M) continue;
      for (let b = a + 1; b < route.length; b++) {
        const len = route[b].d - route[a].d;
        if (len > maxLen) break;
        if (len < minLen) continue;
        if (dist(route[b], eLat, eLon) > MATCH_RADIUS_M) continue;
        if (!follows(segment, route, a, b)) continue;

        const elapsed = Math.round(route[b].t - route[a].t);
        if (elapsed <= 0) continue;
        if (!best || elapsed < best.elapsedMs) {
          best = {
            id: `${segment.id}:${activityId}`,
            segmentId: segment.id,
            activityId,
            startedAt: Math.round(route[a].t),
            elapsedMs: elapsed,
            movingMs: Math.round(movingMsBetween(track, route[a].t, route[b].t)),
            distanceMeters: len,
            paceMinKm: elapsed / 60000 / (len / 1000),
          };
        }
      }
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Analysis entry point
// ---------------------------------------------------------------------------

interface PreparedActivity {
  activity: Activity;
  track: Track;
  runs: RoutePoint[][];
}

const prepare = (activity: Activity): PreparedActivity => {
  const track = prepareTrack(activity.gpsPoints ?? []);
  return { activity, track, runs: resampleRuns(track) };
};

/**
 * Detects new segments shared between `activity` and `history`, then records
 * attempts: new segments are matched against every activity, existing segments
 * only against the analyzed activity. Already-recorded attempts are never duplicated.
 */
export function analyzeSegments(
  activity: Activity,
  history: Activity[],
  store: SegmentStore
): SegmentAnalysisResult {
  const unchanged = (skipped: SegmentAnalysisResult['skipped']): SegmentAnalysisResult => ({
    store,
    newSegments: [],
    attempts: [],
    personalBests: [],
    skipped,
  });

  if (store.processedActivityIds.includes(activity.id)) return unchanged('already_processed');
  if (activity.status !== 'finished') return unchanged('not_finished');

  const current = prepare(activity);
  const markProcessed = { ...store, processedActivityIds: [...store.processedActivityIds, activity.id] };
  if (current.runs.length === 0) {
    return { store: markProcessed, newSegments: [], attempts: [], personalBests: [], skipped: 'insufficient_data' };
  }

  const others = history
    .filter((h) => h.id !== activity.id && h.status === 'finished' && (h.gpsPoints?.length ?? 0) > 1)
    .map(prepare);

  // 1. Discover new segments (deduplicated against existing ones and each other).
  const newSegments: Segment[] = [];
  let counter = store.segments.length;
  for (const other of others) {
    for (const runN of current.runs) {
      for (const otherRun of other.runs) {
        for (const section of sharedSections(runN, otherRun)) {
          const points = section.map((p) => [p.lat, p.lon] as [number, number]);
          const length = section[section.length - 1].d - section[0].d;
          const known = [...store.segments, ...newSegments].some((s) => sameSection(points, length, s));
          if (known) continue;
          counter++;
          newSegments.push({
            id: `seg_${points[0][0].toFixed(4)}_${points[0][1].toFixed(4)}_${Math.round(length / 10)}`,
            name: `Segment ${counter}`,
            lengthMeters: length,
            points,
            createdFromActivityId: activity.id,
            createdAt: activity.endTime ?? activity.startTime,
          });
        }
      }
    }
  }

  // 2. Attempts
  const existing = new Set(store.attempts.map((a) => a.id));
  const added: SegmentAttempt[] = [];
  const addAttempt = (attempt: SegmentAttempt | null) => {
    if (attempt && !existing.has(attempt.id)) {
      existing.add(attempt.id);
      added.push(attempt);
    }
  };

  for (const segment of store.segments) {
    addAttempt(findAttempt(segment, current.track, current.runs, activity.id));
  }
  for (const segment of newSegments) {
    addAttempt(findAttempt(segment, current.track, current.runs, activity.id));
    for (const other of others) {
      addAttempt(findAttempt(segment, other.track, other.runs, other.activity.id));
    }
  }

  // 3. Personal bests for this activity (faster than every earlier attempt)
  const allSegments = [...store.segments, ...newSegments];
  const allAttempts = [...store.attempts, ...added];
  const personalBests: SegmentPersonalBest[] = [];
  for (const attempt of added.filter((a) => a.activityId === activity.id)) {
    const earlier = allAttempts.filter(
      (a) => a.segmentId === attempt.segmentId && a.activityId !== activity.id && a.startedAt < attempt.startedAt
    );
    if (earlier.length === 0) continue;
    const previousBestMs = Math.min(...earlier.map((a) => a.elapsedMs));
    const segment = allSegments.find((s) => s.id === attempt.segmentId);
    if (segment && attempt.elapsedMs < previousBestMs) {
      personalBests.push({ segment, attempt, previousBestMs });
    }
  }

  return {
    store: {
      ...markProcessed,
      segments: allSegments,
      attempts: allAttempts,
    },
    newSegments,
    attempts: added.filter((a) => a.activityId === activity.id),
    personalBests,
  };
}

export interface SegmentSummary {
  segment: Segment;
  attempts: SegmentAttempt[]; // chronological
  best: SegmentAttempt | null;
  latest: SegmentAttempt | null;
  /** First attempt time minus best time (ms). 0 with a single attempt. */
  improvementMs: number;
  /** Running best after each attempt (ms), for progression charts. */
  progression: Array<{ startedAt: number; elapsedMs: number; bestSoFarMs: number }>;
}

export function summarizeSegment(segment: Segment, attempts: SegmentAttempt[]): SegmentSummary {
  const list = attempts
    .filter((a) => a.segmentId === segment.id)
    .sort((a, b) => a.startedAt - b.startedAt);
  let bestSoFar = Infinity;
  const progression = list.map((a) => {
    bestSoFar = Math.min(bestSoFar, a.elapsedMs);
    return { startedAt: a.startedAt, elapsedMs: a.elapsedMs, bestSoFarMs: bestSoFar };
  });
  const best = list.reduce<SegmentAttempt | null>((b, a) => (!b || a.elapsedMs < b.elapsedMs ? a : b), null);
  return {
    segment,
    attempts: list,
    best,
    latest: list.length ? list[list.length - 1] : null,
    improvementMs: list.length > 1 && best ? list[0].elapsedMs - best.elapsedMs : 0,
    progression,
  };
}
