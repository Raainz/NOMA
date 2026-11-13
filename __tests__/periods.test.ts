import {
  DISTANCE_BANDS,
  calendarMonth,
  compareToPrevious,
  comparisonRanges,
  distanceDistribution,
  durationDistribution,
  movingAverage,
  paceInBand,
  rangeForPreset,
  regularity,
  weeklyDistanceTrend,
  formatFrDate,
  parseFrDate,
  weeklyTrendForRange,
} from '../app/analytics/periods';
import { PerfActivity, weeklyBuckets } from '../app/analytics/performance';

const MIN = 60_000;
const at = (m: number, d: number, h = 8) => new Date(2026, m, d, h).getTime();
const NOW = at(5, 17, 12); // Wednesday 17 June 2026

const run = (id: string, start: number, km: number, minutes: number): PerfActivity => ({
  id,
  startTime: start,
  distanceKm: km,
  movingMs: minutes * MIN,
  elapsedMs: minutes * MIN + 2 * MIN,
});

describe('period ranges', () => {
  it('builds rolling and calendar presets in local time, ending with today', () => {
    expect(rangeForPreset('7d', NOW)).toEqual({ from: at(5, 11, 0), to: at(5, 18, 0) });
    expect(rangeForPreset('week', NOW)).toEqual({ from: at(5, 15, 0), to: at(5, 18, 0) });
    expect(rangeForPreset('month', NOW).from).toBe(at(5, 1, 0));
    expect(rangeForPreset('year', NOW).from).toBe(at(0, 1, 0));
  });

  it('normalizes a custom range (inverted bounds, inclusive end day)', () => {
    const r = rangeForPreset('custom', NOW, { from: at(5, 10, 15), to: at(5, 3, 9) });
    expect(r).toEqual({ from: at(5, 3, 0), to: at(5, 11, 0) });
  });

  it('compares a calendar period in progress with the same days of the previous one', () => {
    const week = comparisonRanges('week', NOW);
    expect(week.toDate).toBe(true);
    expect(week.days).toBe(3);
    expect(week.previous).toEqual({ from: at(5, 8, 0), to: at(5, 11, 0) });

    const month = comparisonRanges('month', NOW);
    expect(month.previous).toEqual({ from: at(4, 1, 0), to: at(4, 18, 0) });
  });

  it('never extends a previous month past its end', () => {
    const march31 = at(2, 31, 12);
    const r = comparisonRanges('month', march31);
    expect(r.previous.to).toBe(at(2, 1, 0)); // February ends where March starts
  });

  it('compares rolling presets with the equal span just before', () => {
    const r = comparisonRanges('30d', NOW);
    expect(r.toDate).toBe(false);
    expect(r.previous.to).toBe(r.current.from);
    expect(r.previous.to - r.previous.from).toBe(r.current.to - r.current.from);
  });
});

describe('period comparison', () => {
  const data = [
    run('c1', at(5, 15), 5, 30),
    run('c2', at(5, 16), 5, 30),
    run('p1', at(5, 8), 4, 28),
    run('p2', at(5, 10), 4, 28),
    run('late-previous-week', at(5, 13), 20, 120), // outside the first 3 days of the previous week
  ];

  it('compares equal spans and ignores the rest of the previous period', () => {
    const r = compareToPrevious(data, 'week', NOW);
    expect(r.status).toBe('ok');
    expect(r.previous.count).toBe(2);
    expect(r.previous.distanceKm).toBeCloseTo(8);
    expect(r.comparison!.distance.percent).toBeCloseTo(25);
    expect(r.paceComparable).toBe(true);
  });

  it('refuses to compare a calendar period that has just begun', () => {
    const monday = at(5, 15, 9);
    const r = compareToPrevious(data, 'week', monday);
    expect(r.status).toBe('insufficient');
    expect(r.reason).toBe('period_too_short');
    expect(r.comparison).toBeNull();
  });

  it('refuses to compare with too few activities on either side', () => {
    const r = compareToPrevious([run('c1', at(5, 15), 5, 30), run('p1', at(5, 8), 4, 28)], 'week', NOW);
    expect(r.status).toBe('insufficient');
    expect(r.reason).toBe('few_activities');
  });

  it('does not compare pace without enough distance on both sides', () => {
    const small = [run('c1', at(5, 15), 1, 6), run('c2', at(5, 16), 1, 6), run('p1', at(5, 8), 1, 6), run('p2', at(5, 10), 1, 7)];
    const r = compareToPrevious(small, 'week', NOW);
    expect(r.status).toBe('ok');
    expect(r.paceComparable).toBe(false);
    expect(r.comparison!.pace.percent).toBeNull();
    expect(r.comparison!.distance.percent).toBeCloseTo(0);
  });

  it('handles an empty history', () => {
    const r = compareToPrevious([], '30d', NOW);
    expect(r.status).toBe('insufficient');
    expect(r.current.count).toBe(0);
  });
});

describe('moving average', () => {
  it('averages four values and leaves incomplete windows empty', () => {
    expect(movingAverage([10, 20, 30, 40, 50], 4)).toEqual([null, null, null, 25, 35]);
  });

  it('skips windows containing an incomplete period', () => {
    expect(movingAverage([10, 20, 30, 40, 50], 4, [true, true, true, true, false])).toEqual([null, null, null, 25, null]);
  });

  it('does not average the week in progress', () => {
    const acts = [run('a', at(5, 2), 10, 60), run('b', at(5, 9), 10, 60), run('c', at(5, 16), 10, 60)];
    const trend = weeklyDistanceTrend(weeklyBuckets(acts, NOW, 5), NOW);
    expect(trend[trend.length - 1].complete).toBe(false);
    expect(trend[trend.length - 1].movingAverageKm).toBeNull();
    expect(trend[3].complete).toBe(true);
  });
});

describe('distributions', () => {
  const acts = [
    run('a', at(5, 1), 2.9, 20),
    run('b', at(5, 2), 3, 25),
    run('c', at(5, 3), 5, 30),
    run('d', at(5, 4), 10, 65),
    run('e', at(5, 5), 21.1, 130),
  ];

  it('places distances in half-open bands', () => {
    const d = distanceDistribution(acts);
    expect(d.map((r) => r.count)).toEqual([1, 1, 1, 1, 1]);
    expect(d.reduce((s, r) => s + r.share, 0)).toBeCloseTo(1);
    expect(d[0].band.key).toBe('lt3');
  });

  it('distributes moving durations', () => {
    expect(durationDistribution(acts).map((r) => r.count)).toEqual([2, 1, 1, 1]);
  });

  it('gives the pace progression inside one distance band', () => {
    const band = DISTANCE_BANDS.find((b) => b.key === '5to10')!;
    const more = [...acts, run('f', at(5, 9), 6, 33)];
    expect(paceInBand(more, band).map((p) => p.activityId)).toEqual(['c', 'f']);
  });
});

describe('regularity', () => {
  it('counts active weeks, the longest streak and the average gap', () => {
    const acts = [
      run('a', at(4, 4), 5, 30), // week of 4 May
      run('b', at(4, 11), 5, 30),
      run('c', at(4, 19), 5, 30), // three consecutive weeks
      run('d', at(5, 3), 5, 30), // skip one week
    ];
    const r = regularity(acts, { from: at(4, 4, 0), to: at(5, 8, 0) });
    expect(r.weeks).toBe(5);
    expect(r.activeWeeks).toBe(4);
    expect(r.longestStreakWeeks).toBe(3);
    expect(r.activeDays).toBe(4);
    expect(r.avgGapDays).toBeCloseTo(30 / 3);
  });

  it('has no average gap with a single activity', () => {
    expect(regularity([run('a', at(5, 3), 5, 30)], { from: at(5, 1, 0), to: at(5, 8, 0) }).avgGapDays).toBeNull();
  });
});

describe('calendar', () => {
  const acts = [run('a', at(5, 3), 10, 60), run('b', at(5, 3, 18), 2, 12), run('c', at(5, 10), 5, 30), run('prev-month', at(4, 30), 8, 45)];

  it('builds Monday-first weeks covering the month', () => {
    const weeks = calendarMonth(acts, 2026, 5);
    expect(weeks).toHaveLength(5); // 1 June 2026 is a Monday
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks[0][0].dayOfMonth).toBe(1);
    expect(weeks[0][0].inMonth).toBe(true);
    expect(weeks[4][3].dayOfMonth).toBe(2); // 2 July, outside the month
    expect(weeks[4][3].inMonth).toBe(false);
  });

  it('adds the activities of a day and scales intensity inside the month', () => {
    const weeks = calendarMonth(acts, 2026, 5);
    const third = weeks[0][2];
    expect(third.count).toBe(2);
    expect(third.distanceKm).toBeCloseTo(12);
    expect(third.level).toBe(3);
    expect(weeks[1][2].level).toBe(2); // 5 km vs 12 km max
    expect(weeks[0][5].level).toBe(0);
  });

  it('shows the previous month activity in its own cell only when inside the grid', () => {
    const may = calendarMonth(acts, 2026, 4);
    const flat = may.flat().find((d) => d.date === at(4, 30, 0))!;
    expect(flat.inMonth).toBe(true);
    expect(flat.count).toBe(1);
  });
});

describe('custom range input', () => {
  it('parses dd/mm/yyyy dates and rejects invalid ones', () => {
    expect(parseFrDate('05/06/2026')).toBe(at(5, 5, 0));
    expect(parseFrDate(' 5-6-2026 ')).toBe(at(5, 5, 0));
    expect(parseFrDate('31/02/2026')).toBeNull();
    expect(parseFrDate('2026-06-05')).toBeNull();
    expect(parseFrDate('')).toBeNull();
    expect(parseFrDate('12/13/2026')).toBeNull();
  });

  it('formats a date back to dd/mm/yyyy', () => {
    expect(formatFrDate(at(5, 5, 14))).toBe('05/06/2026');
  });
});

describe('weekly trend over a range', () => {
  it('computes the moving average with weeks before the displayed range', () => {
    const acts = [4, 11, 18, 25].map((d, i) => run('w' + i, at(4, d), 10 * (i + 1), 60)); // May weeks: 10,20,30,40 km
    const trend = weeklyTrendForRange(acts, { from: at(4, 25, 0), to: at(5, 1, 0) }, NOW, 12);
    expect(trend).toHaveLength(1);
    expect(trend[0].distanceKm).toBeCloseTo(40);
    expect(trend[0].movingAverageKm).toBeCloseTo(25);
    expect(trend[0].complete).toBe(true);
  });

  it('shows the week in progress without averaging it', () => {
    const trend = weeklyTrendForRange([run('a', at(5, 16), 8, 50)], rangeForPreset('30d', NOW), NOW, 12);
    const last = trend[trend.length - 1];
    expect(last.complete).toBe(false);
    expect(last.movingAverageKm).toBeNull();
    expect(last.distanceKm).toBeCloseTo(8);
  });

  it('caps the number of displayed weeks', () => {
    expect(weeklyTrendForRange([], rangeForPreset('12m', NOW), NOW, 12)).toHaveLength(12);
  });
});

