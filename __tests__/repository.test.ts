import { AnalyticsRepository, KeyValueStore, RECORDS_KEY } from '../app/analytics/AnalyticsRepository';
import { currentRecords } from '../app/analytics/personalRecords';
import { makeActivity, makeRun } from './helpers/gps';

const DAY = 86_400_000;
const T0 = 1_700_000_000_000;

const memoryKv = (): KeyValueStore & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: async (k) => data.get(k) ?? null,
    setItem: async (k, v) => {
      data.set(k, v);
    },
  };
};

const run = (id: string, speed: number, day: number) =>
  makeActivity(id, makeRun({ legs: [{ speed, meters: 1500 }], startTime: T0 + day * DAY, jitter: 3 }));

describe('AnalyticsRepository', () => {
  it('backfills legacy activities chronologically and is idempotent', async () => {
    const activities = [run('b', 4, 1), run('a', 3, 0)]; // unsorted on purpose
    const kv = memoryKv();
    const repo = new AnalyticsRepository(kv, async () => activities);

    const first = await repo.syncAll();
    expect(first.records.processedActivityIds.sort()).toEqual(['a', 'b']);
    expect(currentRecords(first.records)['best_1k'].activityId).toBe('b');
    expect(first.segments.segments).toHaveLength(1);

    const before = kv.data.get(RECORDS_KEY);
    const second = await repo.syncAll();
    expect(kv.data.get(RECORDS_KEY)).toBe(before);
    expect(second.segments.attempts).toHaveLength(2);
  });

  it('processes a new activity and persists the result', async () => {
    const activities = [run('a', 3, 0)];
    const kv = memoryKv();
    const repo = new AnalyticsRepository(kv, async () => activities);
    await repo.syncAll();

    const b = run('b', 4, 1);
    activities.push(b);
    const result = await repo.processActivity(b);
    expect(result.records.newRecords.some((r) => r.recordKey === 'best_1k')).toBe(true);
    expect(result.segments.personalBests).toHaveLength(1);

    const reloaded = await new AnalyticsRepository(kv, async () => activities).load();
    expect(reloaded.segments.attempts).toHaveLength(2);
  });

  it('recovers from corrupted stored data', async () => {
    const kv = memoryKv();
    kv.data.set(RECORDS_KEY, '{not json');
    const repo = new AnalyticsRepository(kv, async () => [run('a', 3, 0)]);
    const snapshot = await repo.syncAll();
    expect(snapshot.records.processedActivityIds).toEqual(['a']);
  });

  it('serializes concurrent operations without duplicates', async () => {
    const activities = [run('a', 3, 0)];
    const repo = new AnalyticsRepository(memoryKv(), async () => activities);
    await Promise.all([repo.syncAll(), repo.syncAll(), repo.processActivity(activities[0])]);
    const snapshot = await repo.load();
    expect(snapshot.records.processedActivityIds).toEqual(['a']);
  });
});
