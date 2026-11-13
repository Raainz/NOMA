import { buildActivitySummary, computeActivityMetrics, elevationChange } from '../app/analytics/metrics';
import { GPSPoint } from '../app/types';
import { makeActivity, makeRun, makeStatsActivity } from './helpers/gps';

const START = 1_700_000_000_000;

const steady = (meters = 1000, extra: Partial<Parameters<typeof makeRun>[0]> = {}) =>
  makeRun({ legs: [{ speed: 3, meters }], startTime: START, ...extra });

describe('computeActivityMetrics', () => {
  it('measures a clean run with one definition for distance, time and pace', () => {
    const points = steady(1000);
    const m = computeActivityMetrics(makeActivity('a', points));
    expect(m.distanceM).toBeGreaterThan(995);
    expect(m.distanceM).toBeLessThan(1005);
    expect(Math.abs(m.movingMs - m.elapsedMs)).toBeLessThan(1500);
    expect(m.pausedMs).toBeNull();
    expect(m.interruptionCount).toBe(0);
    expect(m.avgPaceMinKm!).toBeCloseTo(5.55, 1);
    expect(m.avgSpeedKmh!).toBeCloseTo(10.8, 0);
  });

  it('does not round segment distances', () => {
    // 1.2 m steps: rounding each step to whole metres would give 1.0 or 2.0 per step.
    const points = makeRun({ legs: [{ speed: 1.2, meters: 600 }], startTime: START });
    const m = computeActivityMetrics(makeActivity('fine', points));
    expect(m.distanceM).toBeGreaterThan(598);
    expect(m.distanceM).toBeLessThan(602);
  });

  it('excludes a GPS interruption from distance and reports it', () => {
    const points = steady(1000).map((p, i, all) => (i >= all.length / 2 ? { ...p, timestamp: p.timestamp + 40_000 } : p));
    const m = computeActivityMetrics(makeActivity('gap', points));
    expect(m.interruptionCount).toBe(1);
    expect(m.interruptionMs).toBeGreaterThan(40_000);
    expect(m.interruptionMs).toBeLessThan(42_000);
    expect(m.distanceM).toBeLessThan(1000);
    expect(m.distanceM).toBeGreaterThan(985);
    expect(m.movingMs).toBeLessThan(m.elapsedMs - 39_000);
    expect(m.pausedMs).toBeNull(); // unknown: never inferred from the gap
  });

  it('attributes a silence to a recorded pause instead of an interruption', () => {
    const points = steady(1000);
    const half = Math.floor(points.length / 2);
    const shifted = points.map((p, i) => (i >= half ? { ...p, timestamp: p.timestamp + 40_000 } : p));
    const pauseStart = points[half - 1].timestamp + 2000;
    const activity = makeActivity('paused', shifted, { pauses: [{ start: pauseStart, end: pauseStart + 38_000 }] });
    const m = computeActivityMetrics(activity);
    expect(m.pausedMs).toBe(38_000);
    expect(m.interruptionCount).toBe(0);
    expect(m.movingMs).toBeLessThan(m.elapsedMs - 38_000 + 1500);
  });

  it('closes an open pause at the end of the activity and merges overlaps', () => {
    const points = steady(300);
    const end = points[points.length - 1].timestamp;
    const activity = makeActivity('open', points, {
      pauses: [
        { start: end - 20_000, end: null },
        { start: end - 10_000, end: end - 5_000 },
      ],
    });
    expect(computeActivityMetrics(activity).pausedMs).toBe(20_000);
  });

  it('separates stopped time from moving time', () => {
    const run = steady(300);
    const last = run[run.length - 1];
    const standing: GPSPoint[] = Array.from({ length: 60 }, (_, i) => ({ ...last, timestamp: last.timestamp + (i + 1) * 1000 }));
    const m = computeActivityMetrics(makeActivity('stop', [...run, ...standing]));
    expect(m.stoppedMs).toBeGreaterThan(58_000);
    expect(m.stoppedMs).toBeLessThan(62_000);
    expect(m.movingMs).toBeLessThan(105_000);
    expect(m.interruptionCount).toBe(0);
  });

  it('ignores aberrant points', () => {
    const points = steady(1000);
    const spike = { ...points[100], latitude: points[100].latitude + 0.05, timestamp: points[100].timestamp + 500 };
    const polluted = [...points.slice(0, 101), spike, ...points.slice(101)];
    const clean = computeActivityMetrics(makeActivity('c', points));
    const m = computeActivityMetrics(makeActivity('p', polluted));
    expect(m.discardedPoints).toBeGreaterThanOrEqual(1);
    expect(Math.abs(m.distanceM - clean.distanceM)).toBeLessThan(10);
  });

  it('does not trust the raw GPS speed for the maximum speed', () => {
    const points = steady(600).map((p, i) => (i === 50 ? { ...p, speed: 25 } : p));
    const m = computeActivityMetrics(makeActivity('speed', points));
    expect(m.maxSpeedKmh!).toBeGreaterThan(10);
    expect(m.maxSpeedKmh!).toBeLessThan(11.5);
  });

  it('reports no pace or max speed with too little data', () => {
    const m = computeActivityMetrics(makeActivity('short', steady(60)));
    expect(m.avgPaceMinKm).toBeNull();
    expect(m.maxSpeedKmh).toBeNull();
  });

  it('uses end minus start as elapsed time', () => {
    const m = computeActivityMetrics(makeActivity('e', steady(300), { endTime: START + 500_000 }));
    expect(m.elapsedMs).toBe(500_000);
  });
});

describe('elevation', () => {
  it('ignores small altitude noise', () => {
    const noisy = Array.from({ length: 80 }, (_, i) => 100 + (i % 2 ? 1.2 : -1.2));
    expect(elevationChange(noisy)).toEqual({ gain: 0, loss: 0 });
  });

  it('keeps a real climb and descent', () => {
    const up = Array.from({ length: 40 }, (_, i) => 100 + i * 0.5); // +19.5 m
    const down = Array.from({ length: 40 }, (_, i) => 119.5 - i * 0.5);
    const e = elevationChange([...up, ...down])!;
    expect(e.gain).toBeGreaterThan(16);
    expect(e.gain).toBeLessThan(20.5);
    expect(e.loss).toBeGreaterThan(16);
  });

  it('is unavailable without enough altitude data', () => {
    expect(elevationChange(Array(50).fill(null))).toBeNull();
    const sparse = Array.from({ length: 50 }, (_, i) => (i % 3 === 0 ? 100 + i : null));
    expect(elevationChange(sparse)).toBeNull();
  });

  it('flows through the activity metrics', () => {
    const points = steady(1000, { altitude: (d) => 100 + d / 50 });
    const m = computeActivityMetrics(makeActivity('climb', points));
    expect(m.elevationGainM!).toBeGreaterThan(16);
    expect(m.elevationGainM!).toBeLessThan(20.5);
    expect(computeActivityMetrics(makeActivity('flat-null', steady(500, { altitude: () => null }))).elevationGainM).toBeNull();
  });
});

describe('buildActivitySummary', () => {
  it('returns null for unfinished activities', () => {
    expect(buildActivitySummary(makeActivity('u', steady(300), { status: 'started', endTime: null }))).toBeNull();
  });

  it('computes from the trace when available', () => {
    const s = buildActivitySummary(makeActivity('t', steady(1000)))!;
    expect(s.source).toBe('trace');
    expect(s.id).toBe('t');
    expect(s.distanceM).toBeGreaterThan(995);
  });

  it('falls back on the stored stats when there is no usable trace', () => {
    const legacy = makeStatsActivity('legacy', START, 5, 1_800_000);
    const s = buildActivitySummary(legacy)!;
    expect(s.source).toBe('stored');
    expect(s.distanceM).toBe(5000);
    expect(s.movingMs).toBe(1_800_000);
    expect(s.avgPaceMinKm!).toBeCloseTo(6, 5);
    expect(s.elevationGainM).toBeNull();
  });
});
