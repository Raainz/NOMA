import { analyzeSegments, emptySegmentStore, summarizeSegment } from '../app/analytics/segments';
import { M_PER_DEG, makeActivity, makeRun } from './helpers/gps';

const DAY = 86_400_000;
const T0 = 1_700_000_000_000;
const route = (id: string, speed: number, day: number, extra = {}) =>
  makeActivity(
    id,
    makeRun({ legs: [{ speed, meters: 1500 }], startTime: T0 + day * DAY, jitter: 3, ...extra })
  );

describe('segments', () => {
  it('does nothing with a single activity', () => {
    const res = analyzeSegments(route('a', 3, 0), [], emptySegmentStore());
    expect(res.newSegments).toHaveLength(0);
    expect(res.store.processedActivityIds).toEqual(['a']);
  });

  it('detects a shared section and records an attempt for each activity', () => {
    const a = route('a', 3, 0);
    const b = route('b', 4, 1);
    const s1 = analyzeSegments(a, [], emptySegmentStore()).store;
    const res = analyzeSegments(b, [a], s1);
    expect(res.newSegments).toHaveLength(1);
    expect(res.store.attempts).toHaveLength(2);

    const summary = summarizeSegment(res.newSegments[0], res.store.attempts);
    expect(summary.best!.activityId).toBe('b');
    expect(summary.attempts.map((x) => x.activityId)).toEqual(['a', 'b']);
    expect(summary.improvementMs).toBeGreaterThan(100_000);
    expect(res.personalBests).toHaveLength(1);
  });

  it('adds attempts of later activities to existing segments without recreating them', () => {
    const a = route('a', 3, 0);
    const b = route('b', 4, 1);
    const c = route('c', 3.5, 2);
    const s1 = analyzeSegments(a, [], emptySegmentStore()).store;
    const s2 = analyzeSegments(b, [a], s1).store;
    const res = analyzeSegments(c, [a, b], s2);
    expect(res.newSegments).toHaveLength(0);
    expect(res.store.segments).toHaveLength(1);
    expect(res.store.attempts).toHaveLength(3);
    expect(res.personalBests).toHaveLength(0); // slower than b
  });

  it('does not duplicate attempts when analysis is repeated', () => {
    const a = route('a', 3, 0);
    const b = route('b', 4, 1);
    const s1 = analyzeSegments(a, [], emptySegmentStore()).store;
    const s2 = analyzeSegments(b, [a], s1).store;
    const again = analyzeSegments(b, [a], s2);
    expect(again.skipped).toBe('already_processed');
    expect(again.store.attempts).toHaveLength(2);
  });

  it('does not match the opposite direction or a different route', () => {
    const a = route('a', 3, 0);
    const reverse = route('r', 3, 1, { heading: 'south', startLat: 1500 / M_PER_DEG });
    const elsewhere = route('e', 3, 2, { heading: 'east', startLat: 1 });
    const s1 = analyzeSegments(a, [], emptySegmentStore()).store;
    expect(analyzeSegments(reverse, [a], s1).newSegments).toHaveLength(0);
    expect(analyzeSegments(elsewhere, [a], s1).newSegments).toHaveLength(0);
  });
});
