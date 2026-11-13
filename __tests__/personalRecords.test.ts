import { analyzeActivity, currentRecords, emptyRecordsStore, recordHistory } from '../app/analytics/personalRecords';
import { makeActivity, makeRun } from './helpers/gps';

const DAY = 86_400_000;
const T0 = 1_700_000_000_000;
const run5k = (id: string, speed: number, day: number) =>
  makeActivity(id, makeRun({ legs: [{ speed, meters: 5100 }], startTime: T0 + day * DAY }));

describe('personal records', () => {
  it('creates first-effort records for every distance reached', () => {
    const res = analyzeActivity(run5k('a', 4, 0), emptyRecordsStore());
    const keys = res.newRecords.map((r) => r.recordKey);
    expect(keys).toEqual(expect.arrayContaining(['best_1k', 'best_1mi', 'best_3k', 'best_5k']));
    expect(keys).not.toContain('best_10k');
    expect(res.achievements.some((a) => a.type === 'first_effort')).toBe(true);
    expect(res.newRecords.every((r) => r.previousValue === null)).toBe(true);
  });

  it('detects a beaten record and keeps the previous value', () => {
    const first = analyzeActivity(run5k('a', 4, 0), emptyRecordsStore());
    const second = analyzeActivity(run5k('b', 5, 1), first.store);
    const entry = second.newRecords.find((r) => r.recordKey === 'best_5k')!;
    expect(entry.previousActivityId).toBe('a');
    expect(entry.previousValue).toBeGreaterThan(entry.value);
    expect(entry.improvement).toBeGreaterThan(200_000);
    expect(second.achievements.some((a) => a.type === 'personal_record')).toBe(true);
  });

  it('preserves record history', () => {
    const s1 = analyzeActivity(run5k('a', 4, 0), emptyRecordsStore()).store;
    const s2 = analyzeActivity(run5k('b', 5, 1), s1).store;
    const history = recordHistory(s2, 'best_5k');
    expect(history.map((h) => h.activityId)).toEqual(['a', 'b']);
    expect(currentRecords(s2)['best_5k'].activityId).toBe('b');
  });

  it('does not create a record for a slower run', () => {
    const s1 = analyzeActivity(run5k('a', 5, 0), emptyRecordsStore()).store;
    const res = analyzeActivity(run5k('b', 4, 1), s1);
    expect(res.newRecords.filter((r) => r.recordKey.startsWith('best_'))).toHaveLength(0);
    expect(currentRecords(res.store)['best_5k'].activityId).toBe('a');
  });

  it('prevents duplicates when the same activity is analyzed twice', () => {
    const activity = run5k('a', 4, 0);
    const once = analyzeActivity(activity, emptyRecordsStore());
    const twice = analyzeActivity(activity, once.store);
    expect(twice.skipped).toBe('already_processed');
    expect(twice.store.history).toHaveLength(once.store.history.length);
    expect(twice.store.achievements).toHaveLength(once.store.achievements.length);
  });

  it('ignores unfinished activities without marking them processed', () => {
    const activity = { ...run5k('a', 4, 0), status: 'paused' as const };
    const res = analyzeActivity(activity, emptyRecordsStore());
    expect(res.skipped).toBe('not_finished');
    expect(res.store.processedActivityIds).toEqual([]);
  });

  it('skips activities without enough data', () => {
    const tiny = makeActivity('t', makeRun({ legs: [{ speed: 2, meters: 20 }] }));
    const res = analyzeActivity(tiny, emptyRecordsStore());
    expect(res.skipped).toBe('insufficient_data');
    expect(res.store.history).toHaveLength(0);
  });

  it('tracks the longest activity', () => {
    const s1 = analyzeActivity(run5k('a', 4, 0), emptyRecordsStore()).store;
    const longer = makeActivity('b', makeRun({ legs: [{ speed: 4, meters: 6000 }], startTime: T0 + DAY }));
    const res = analyzeActivity(longer, s1);
    expect(res.newRecords.some((r) => r.recordKey === 'longest_activity')).toBe(true);
  });
});
