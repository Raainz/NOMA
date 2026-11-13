/**
 * Period engine for the Performance dashboard (pure, no I/O).
 *
 * - presets and custom ranges (local time, weeks start on Monday);
 * - comparison with an EQUIVALENT previous period (to-date for calendar periods), never partial vs full;
 * - explicit "insufficient data" results instead of misleading percentages;
 * - 4-week moving average, distance / duration distributions, regularity, activity calendar.
 *
 * Descriptive only: no coaching and no recommendation.
 */

import {
  Bucket,
  PerfInput,
  PeriodComparison,
  PeriodSummary,
  addDays,
  addMonths,
  comparePeriods,
  inRange,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  summarize,
  toPerf,
  validActivities,
} from './performance';

/** [from, to) in ms, local time. */
export interface DateRange {
  from: number;
  to: number;
}

export type PeriodPreset = '7d' | '30d' | '90d' | '12m' | 'week' | 'month' | 'year' | 'custom';

export const PERIOD_PRESETS: PeriodPreset[] = ['7d', '30d', '90d', '12m', 'week', 'month', 'year', 'custom'];

/** Both sides need at least this many activities for a comparison to be shown. */
export const MIN_ACTIVITIES_PER_SIDE = 2;
/** Pace is compared only when both sides cover at least this distance (km). */
export const MIN_KM_FOR_PACE_COMPARISON = 3;
/** A calendar period younger than this (days) is not compared with the previous one. */
export const MIN_DAYS_FOR_PARTIAL_COMPARISON = 3;

const DAY_MS = 86_400_000;

export const daysBetween = (from: number, to: number): number => Math.round((startOfDay(to) - startOfDay(from)) / DAY_MS);

/** Range covered by a preset, ending with the whole of today (calendar presets run to the end of today too). */
export function rangeForPreset(preset: PeriodPreset, now: number, custom?: DateRange): DateRange {
  const today = startOfDay(now);
  const end = addDays(today, 1);
  switch (preset) {
    case '7d':
      return { from: addDays(today, -6), to: end };
    case '30d':
      return { from: addDays(today, -29), to: end };
    case '90d':
      return { from: addDays(today, -89), to: end };
    case '12m':
      return { from: addMonths(startOfMonth(now), -11), to: end };
    case 'week':
      return { from: startOfWeek(now), to: end };
    case 'month':
      return { from: startOfMonth(now), to: end };
    case 'year':
      return { from: startOfYear(now), to: end };
    case 'custom': {
      const from = startOfDay(Math.min(custom?.from ?? today, custom?.to ?? today));
      const to = addDays(startOfDay(Math.max(custom?.from ?? today, custom?.to ?? today)), 1);
      return { from, to: Math.max(to, addDays(from, 1)) };
    }
  }
}

export interface ComparisonRanges {
  current: DateRange;
  previous: DateRange;
  /** True for a calendar period still in progress: the previous one is cut at the same day. */
  toDate: boolean;
  /** Days covered by each side. */
  days: number;
}

/**
 * Equivalent previous period:
 * - rolling presets and custom ranges: the same number of days immediately before;
 * - week / month / year in progress: the first N days of the previous week / month / year (N = days elapsed).
 */
export function comparisonRanges(preset: PeriodPreset, now: number, custom?: DateRange): ComparisonRanges {
  const current = rangeForPreset(preset, now, custom);
  const days = daysBetween(current.from, current.to);

  if (preset === 'week' || preset === 'month' || preset === 'year') {
    const prevStart = preset === 'week' ? addDays(current.from, -7) : addMonths(current.from, preset === 'month' ? -1 : -12);
    // Previous period boundaries: [prevStart, current.from).
    const to = Math.min(addDays(prevStart, days), current.from);
    return { current, previous: { from: prevStart, to }, toDate: true, days };
  }

  return { current, previous: { from: addDays(current.from, -days), to: current.from }, toDate: false, days };
}

export type InsufficientReason = 'period_too_short' | 'few_activities';

export interface PeriodComparisonResult {
  status: 'ok' | 'insufficient';
  reason?: InsufficientReason;
  ranges: ComparisonRanges;
  current: PeriodSummary;
  previous: PeriodSummary;
  /** Present only when status is 'ok'. */
  comparison: PeriodComparison | null;
  /** False when the pace comparison lacks distance on one side; its percent is then null. */
  paceComparable: boolean;
}

export function compareToPrevious(
  items: PerfInput[],
  preset: PeriodPreset,
  now: number,
  custom?: DateRange
): PeriodComparisonResult {
  const ranges = comparisonRanges(preset, now, custom);
  const current = summarize(inRange(items, ranges.current.from, ranges.current.to));
  const previous = summarize(inRange(items, ranges.previous.from, ranges.previous.to));
  const base = { ranges, current, previous, comparison: null, paceComparable: false };

  if (ranges.toDate && ranges.days < MIN_DAYS_FOR_PARTIAL_COMPARISON) {
    return { ...base, status: 'insufficient', reason: 'period_too_short' };
  }
  if (current.count < MIN_ACTIVITIES_PER_SIDE || previous.count < MIN_ACTIVITIES_PER_SIDE) {
    return { ...base, status: 'insufficient', reason: 'few_activities' };
  }

  const comparison = comparePeriods(current, previous);
  const paceComparable =
    current.distanceKm >= MIN_KM_FOR_PACE_COMPARISON && previous.distanceKm >= MIN_KM_FOR_PACE_COMPARISON;
  if (!paceComparable) comparison.pace = { ...comparison.pace, percent: null };
  return { ...base, status: 'ok', comparison, paceComparable };
}

// ---------------------------------------------------------------------------
// Moving average
// ---------------------------------------------------------------------------

/**
 * Trailing moving average. Entries without a full window are null. Buckets that are not complete
 * (the week in progress) must be excluded by the caller through `include`.
 */
export function movingAverage(values: number[], window = 4, include: boolean[] = []): Array<number | null> {
  return values.map((_, i) => {
    if (i < window - 1) return null;
    const slice = values.slice(i - window + 1, i + 1);
    const ok = slice.every((_v, k) => include[i - window + 1 + k] !== false);
    return ok ? slice.reduce((s, v) => s + v, 0) / window : null;
  });
}

/** Weekly distance with its 4-week moving average; the week in progress is shown but not averaged. */
export function weeklyDistanceTrend(buckets: Bucket[], now: number, window = 4) {
  const complete = buckets.map((b) => b.end <= now);
  const average = movingAverage(
    buckets.map((b) => b.distanceKm),
    window,
    complete
  );
  return buckets.map((b, i) => ({ bucket: b, distanceKm: b.distanceKm, movingAverageKm: average[i], complete: complete[i] }));
}

// ---------------------------------------------------------------------------
// Distributions
// ---------------------------------------------------------------------------

export interface Band {
  key: string;
  label: string;
  /** Inclusive lower, exclusive upper bound. */
  min: number;
  max: number;
}

export const DISTANCE_BANDS: Band[] = [
  { key: 'lt3', label: 'Moins de 3 km', min: 0, max: 3 },
  { key: '3to5', label: '3 à 5 km', min: 3, max: 5 },
  { key: '5to10', label: '5 à 10 km', min: 5, max: 10 },
  { key: '10to21', label: '10 à 21 km', min: 10, max: 21.0975 },
  { key: 'gt21', label: 'Plus de 21 km', min: 21.0975, max: Infinity },
];

/** Moving time bands, in minutes. */
export const DURATION_BANDS: Band[] = [
  { key: 'lt30', label: 'Moins de 30 min', min: 0, max: 30 },
  { key: '30to60', label: '30 à 60 min', min: 30, max: 60 },
  { key: '60to90', label: '1 h à 1 h 30', min: 60, max: 90 },
  { key: 'gt90', label: 'Plus de 1 h 30', min: 90, max: Infinity },
];

export interface BandShare {
  band: Band;
  count: number;
  distanceKm: number;
  /** Share of the activity count, 0-1. */
  share: number;
}

function distribute(items: PerfInput[], bands: Band[], valueOf: (a: ReturnType<typeof validActivities>[number]) => number): BandShare[] {
  const valid = validActivities(items);
  const rows = bands.map((band) => ({ band, count: 0, distanceKm: 0, share: 0 }));
  for (const a of valid) {
    const v = valueOf(a);
    const row = rows.find((r) => v >= r.band.min && v < r.band.max);
    if (row) {
      row.count += 1;
      row.distanceKm += a.distanceKm;
    }
  }
  for (const r of rows) r.share = valid.length ? r.count / valid.length : 0;
  return rows;
}

export const distanceDistribution = (items: PerfInput[]): BandShare[] => distribute(items, DISTANCE_BANDS, (a) => a.distanceKm);
export const durationDistribution = (items: PerfInput[]): BandShare[] => distribute(items, DURATION_BANDS, (a) => a.movingMs / 60000);

/** Pace per activity restricted to one distance band, for progression on comparable distances. */
export function paceInBand(items: PerfInput[], band: Band): Array<{ time: number; value: number; activityId: string }> {
  return validActivities(items)
    .filter((a) => a.distanceKm >= band.min && a.distanceKm < band.max)
    .sort((a, b) => a.startTime - b.startTime)
    .map((a) => ({ time: a.startTime, value: a.movingMs / 60000 / a.distanceKm, activityId: a.id }));
}

// ---------------------------------------------------------------------------
// Regularity
// ---------------------------------------------------------------------------

export interface Regularity {
  weeks: number;
  activeWeeks: number;
  activeDays: number;
  /** Average days between two consecutive activities, null with fewer than two. */
  avgGapDays: number | null;
  /** Longest run of consecutive weeks with at least one activity. */
  longestStreakWeeks: number;
}

export function regularity(items: PerfInput[], range: DateRange): Regularity {
  const inside = validActivities(inRange(items, range.from, range.to)).sort((a, b) => a.startTime - b.startTime);
  const firstWeek = startOfWeek(range.from);
  const weeks = Math.max(1, Math.round((startOfWeek(range.to - 1) - firstWeek) / (7 * DAY_MS)) + 1);

  const activeWeekIdx = new Set(inside.map((a) => Math.round((startOfWeek(a.startTime) - firstWeek) / (7 * DAY_MS))));
  let streak = 0;
  let longest = 0;
  for (let w = 0; w < weeks; w++) {
    streak = activeWeekIdx.has(w) ? streak + 1 : 0;
    longest = Math.max(longest, streak);
  }

  const activeDays = new Set(inside.map((a) => startOfDay(a.startTime))).size;
  let avgGapDays: number | null = null;
  if (inside.length >= 2) {
    const first = startOfDay(inside[0].startTime);
    const last = startOfDay(inside[inside.length - 1].startTime);
    avgGapDays = Math.round((last - first) / DAY_MS) / (inside.length - 1);
  }

  return { weeks, activeWeeks: activeWeekIdx.size, activeDays, avgGapDays, longestStreakWeeks: longest };
}

// ---------------------------------------------------------------------------
// Activity calendar
// ---------------------------------------------------------------------------

export interface CalendarDay {
  /** Local midnight of the day. */
  date: number;
  dayOfMonth: number;
  inMonth: boolean;
  count: number;
  distanceKm: number;
  /** 0 = no activity, 1-3 = relative intensity inside the month. */
  level: 0 | 1 | 2 | 3;
  activityIds: string[];
}

/** Monday-first grid of whole weeks covering the month of (year, month). */
export function calendarMonth(items: PerfInput[], year: number, month: number): CalendarDay[][] {
  const first = new Date(year, month, 1).getTime();
  const gridStart = startOfWeek(first);
  const nextMonth = new Date(year, month + 1, 1).getTime();
  const gridEnd = addDays(startOfWeek(nextMonth - 1), 7);

  const byDay = new Map<number, { count: number; distanceKm: number; ids: string[] }>();
  for (const p of validActivities(inRange(items, gridStart, gridEnd))) {
    const key = startOfDay(p.startTime);
    const cell = byDay.get(key) ?? { count: 0, distanceKm: 0, ids: [] };
    cell.count += 1;
    cell.distanceKm += p.distanceKm;
    cell.ids.push(p.id);
    byDay.set(key, cell);
  }

  const maxInMonth = Math.max(
    0,
    ...[...byDay.entries()].filter(([day]) => day >= first && day < nextMonth).map(([, c]) => c.distanceKm)
  );

  const weeks: CalendarDay[][] = [];
  for (let weekStart = gridStart; weekStart < gridEnd; weekStart = addDays(weekStart, 7)) {
    const row: CalendarDay[] = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(weekStart, i);
      const cell = byDay.get(date);
      const level = !cell || maxInMonth === 0 ? 0 : (Math.min(3, Math.max(1, Math.ceil((3 * cell.distanceKm) / maxInMonth))) as 1 | 2 | 3);
      row.push({
        date,
        dayOfMonth: new Date(date).getDate(),
        inMonth: date >= first && date < nextMonth,
        count: cell?.count ?? 0,
        distanceKm: cell?.distanceKm ?? 0,
        level,
        activityIds: cell?.ids ?? [],
      });
    }
    weeks.push(row);
  }
  return weeks;
}

/** Convenience for screens: normalized valid activities of a range. */
export function activitiesInRange(items: PerfInput[], range: DateRange) {
  return inRange(items, range.from, range.to).filter((i) => toPerf(i) !== null);
}

// ---------------------------------------------------------------------------
// Custom range input (dd/mm/yyyy, no date-picker dependency)
// ---------------------------------------------------------------------------

/** Parses "jj/mm/aaaa" (also accepts "-" or "." separators) into local midnight, null when invalid. */
export function parseFrDate(text: string): number | null {
  const m = /^\s*(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})\s*$/.exec(text);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (year < 1970 || year > 2200) return null;
  const d = new Date(year, month - 1, day);
  // Reject overflow such as 31/02 (the Date constructor rolls over silently).
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return d.getTime();
}

const pad2 = (n: number) => String(n).padStart(2, '0');
export const formatFrDate = (ts: number): string => {
  const d = new Date(ts);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
};

// ---------------------------------------------------------------------------
// Weekly trend over a range, with a 4-week moving average
// ---------------------------------------------------------------------------

export interface WeeklyTrendPoint {
  bucket: Bucket;
  distanceKm: number;
  /** Trailing 4-week average; null without 4 complete weeks or while the week is in progress. */
  movingAverageKm: number | null;
  complete: boolean;
}

/**
 * Weeks covering `range` (at most `maxWeeks`, the most recent ones). The average is computed with the
 * three weeks BEFORE the displayed ones so it is already available on the first displayed week.
 */
export function weeklyTrendForRange(items: PerfInput[], range: DateRange, now: number, maxWeeks = 12): WeeklyTrendPoint[] {
  const lastWeek = startOfWeek(Math.min(range.to - 1, now));
  const firstWanted = startOfWeek(range.from);
  const count = Math.min(maxWeeks, Math.round((lastWeek - firstWanted) / (7 * DAY_MS)) + 1);
  const firstShown = addDays(lastWeek, -7 * (count - 1));

  const buckets: Bucket[] = [];
  for (let i = -3; i < count; i++) {
    const start = addDays(firstShown, 7 * i);
    const end = addDays(start, 7);
    buckets.push({ start, end, ...summarize(inRange(items, start, end)) });
  }
  return weeklyDistanceTrend(buckets, now).slice(3);
}

