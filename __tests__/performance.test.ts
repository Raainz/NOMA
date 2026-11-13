import {
  comparePeriods,
  filterActivities,
  monthlyBuckets,
  paceSeries,
  startOfWeek,
  summarize,
  weeklyBuckets,
} from '../app/analytics/performance';
import { makeStatsActivity } from './helpers/gps';

const MIN = 60_000;
const at = (m: number, d: number, h = 8) => new Date(2026, m, d, h).getTime();
const NOW = at(5, 17, 12); // Wednesday 17 June 2026

describe('performance analytics', () => {
  const activities = [
    makeStatsActivity('this', at(5, 15), 5, 30 * MIN), // Monday of this week
    makeStatsActivity('prev1', at(5, 9), 4, 24 * MIN),
    makeStatsActivity('prev2', at(5, 14), 6, 36 * MIN), // Sunday: previous week
    makeStatsActivity('may', at(4, 20), 10, 60 * MIN),
    { ...makeStatsActivity('unfinished', at(5, 16), 3, 20 * MIN), status: 'paused' as const },
    makeStatsActivity('tiny', at(5, 16), 0.05, MIN),
  ];

  it('starts weeks on Monday', () => {
    expect(startOfWeek(at(5, 14))).toBe(at(5, 8, 0));
    expect(startOfWeek(at(5, 15))).toBe(at(5, 15, 0));
  });

  it('summarizes only valid finished activities', () => {
    const s = summarize(activities);
    expect(s.count).toBe(4);
    expect(s.distanceKm).toBeCloseTo(25);
    expect(s.avgPaceMinKm).toBeCloseTo(6);
    expect(summarize([]).avgPaceMinKm).toBeNull();
  });

  it('builds weekly buckets oldest first', () => {
    const buckets = weeklyBuckets(activities, NOW, 3);
    expect(buckets).toHaveLength(3);
    expect(buckets[2].distanceKm).toBeCloseTo(5);
    expect(buckets[1].distanceKm).toBeCloseTo(10);
    expect(buckets[0].count).toBe(0);
  });

  it('builds monthly buckets', () => {
    const buckets = monthlyBuckets(activities, NOW, 2);
    expect(buckets[0].distanceKm).toBeCloseTo(10);
    expect(buckets[1].distanceKm).toBeCloseTo(15);
  });

  it('compares periods and avoids division by zero', () => {
    const [prevWeek, thisWeek] = weeklyBuckets(activities, NOW, 2);
    const cmp = comparePeriods(thisWeek, prevWeek);
    expect(cmp.distance.percent).toBeCloseTo(-50);
    expect(cmp.count.percent).toBeCloseTo(-50);
    const empty = comparePeriods(summarize(activities), summarize([]));
    expect(empty.distance.percent).toBeNull();
    expect(empty.pace.percent).toBeNull();
  });

  it('builds a chronological pace series', () => {
    const series = paceSeries(activities);
    expect(series.map((p) => p.activityId)).toEqual(['may', 'prev1', 'prev2', 'this']);
    expect(series[0].value).toBeCloseTo(6);
  });

  it('filters by date and distance', () => {
    expect(filterActivities(activities, { minKm: 5 }).map((a) => a.id).sort()).toEqual(['may', 'prev2', 'this']);
    expect(filterActivities(activities, { from: at(5, 1) }).length).toBe(4); // unfinished activities are never listed
  });
});
