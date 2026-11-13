import { prepareTrack } from '../app/analytics/track';
import { bestEffort, computeSplits } from '../app/analytics/efforts';
import { makeRun, shiftTime } from './helpers/gps';

describe('prepareTrack', () => {
  it('accumulates distance and time on a clean run', () => {
    const track = prepareTrack(makeRun({ legs: [{ speed: 4, meters: 2000 }] }));
    expect(track.totalDistance).toBeCloseTo(2000, 0);
    expect(track.runs).toHaveLength(1);
    expect(track.discardedPoints).toBe(0);
  });

  it('discards inaccurate points and GPS spikes without adding distance', () => {
    const points = makeRun({ legs: [{ speed: 4, meters: 1000 }] });
    points[100] = { ...points[100], accuracy: 120 };
    points[200] = { ...points[200], latitude: points[200].latitude + 500 / 111195 };
    const track = prepareTrack(points);
    expect(track.discardedPoints).toBeGreaterThanOrEqual(2);
    expect(track.totalDistance).toBeCloseTo(1000, -1);
  });

  it('splits runs at long gaps and adds no distance across them', () => {
    const a = makeRun({ legs: [{ speed: 4, meters: 1000 }] });
    const last = a[a.length - 1];
    const b = shiftTime(
      makeRun({ legs: [{ speed: 4, meters: 1000 }], startLat: last.latitude + 2000 / 111195 }),
      last.timestamp - a[0].timestamp + 120_000
    );
    const track = prepareTrack([...a, ...b]);
    expect(track.runs).toHaveLength(2);
    expect(track.totalDistance).toBeCloseTo(2000, -1);
  });
});

describe('bestEffort', () => {
  it('finds the exact distance on a constant pace run', () => {
    const track = prepareTrack(makeRun({ legs: [{ speed: 4, meters: 6000 }] }));
    expect(bestEffort(track, 5000)!.durationMs).toBeGreaterThanOrEqual(1_249_000);
    expect(bestEffort(track, 5000)!.durationMs).toBeLessThanOrEqual(1_251_000);
    expect(bestEffort(track, 1000)!.durationMs).toBeCloseTo(250_000, -3);
  });

  it('is not limited to kilometre splits', () => {
    // Fast 1000 m straddles both kilometre boundaries.
    const track = prepareTrack(
      makeRun({
        legs: [
          { speed: 4, meters: 500 },
          { speed: 8, meters: 1000 },
          { speed: 4, meters: 500 },
        ],
      })
    );
    const splits = computeSplits(track, 1000);
    const bestSplit = Math.min(...splits.map((s) => s.durationMs));
    expect(bestSplit).toBeGreaterThan(180_000);
    expect(bestEffort(track, 1000)!.durationMs).toBeCloseTo(125_000, -3);
  });

  it('returns null when the run is shorter than the target', () => {
    const track = prepareTrack(makeRun({ legs: [{ speed: 4, meters: 900 }] }));
    expect(bestEffort(track, 1000)).toBeNull();
  });

  it('never spans a pause or GPS gap', () => {
    const a = makeRun({ legs: [{ speed: 4, meters: 3000 }] });
    const last = a[a.length - 1];
    const b = shiftTime(
      makeRun({ legs: [{ speed: 4, meters: 3000 }], startLat: last.latitude + 10 / 111195 }),
      last.timestamp - a[0].timestamp + 180_000
    );
    const track = prepareTrack([...a, ...b]);
    expect(bestEffort(track, 3000)).not.toBeNull();
    expect(bestEffort(track, 5000)).toBeNull();
  });
});

describe('computeSplits', () => {
  it('returns one split per kilometre plus a partial split', () => {
    const track = prepareTrack(makeRun({ legs: [{ speed: 4, meters: 2500 }] }));
    const splits = computeSplits(track, 1000);
    expect(splits).toHaveLength(3);
    expect(splits[0].durationMs).toBeCloseTo(250_000, -3);
  });
});
