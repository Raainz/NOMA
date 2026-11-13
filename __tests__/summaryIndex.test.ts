import AsyncStorage from '@react-native-async-storage/async-storage';
import { METRICS_VERSION } from '../app/analytics/metrics';
import { ActivitySummaryIndex, SUMMARIES_KEY } from '../app/analytics/summaryIndex';
import { ActivityStorageService } from '../app/services/ActivityStorageService';
import { Activity } from '../app/types';
import { makeActivity, makeRun } from './helpers/gps';

const activity = (id: string, start: number, meters = 600): Activity =>
  makeActivity(id, makeRun({ legs: [{ speed: 3, meters }], startTime: start }));

function memoryKv() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: async (k: string) => map.get(k) ?? null,
    setItem: async (k: string, v: string) => void map.set(k, v),
    removeItem: async (k: string) => void map.delete(k),
  };
}

function harness(activities: Activity[]) {
  const kv = memoryKv();
  const reads: string[] = [];
  const store = new Map(activities.map((a) => [a.id, a]));
  const index = new ActivitySummaryIndex(kv, {
    listIds: async () => [...store.keys()],
    getActivity: async (id) => {
      reads.push(id);
      return store.get(id) ?? null;
    },
  });
  return { kv, reads, store, index };
}

describe('ActivitySummaryIndex', () => {
  it('backfills missing summaries from the saved activities, newest first', async () => {
    const h = harness([activity('old', 1_700_000_000_000), activity('new', 1_800_000_000_000)]);
    const all = await h.index.getAll();
    expect(all.map((s) => s.id)).toEqual(['new', 'old']);
    expect(all[0].version).toBe(METRICS_VERSION);
    expect(h.reads.sort()).toEqual(['new', 'old']);
  });

  it('reads no activity (no GPS point) once the index is complete', async () => {
    const h = harness([activity('a', 1_700_000_000_000), activity('b', 1_800_000_000_000)]);
    await h.index.getAll();
    h.reads.length = 0;
    await h.index.getAll();
    expect(h.reads).toEqual([]);
  });

  it('only reads the activities that are missing', async () => {
    const h = harness([activity('a', 1_700_000_000_000)]);
    await h.index.getAll();
    h.store.set('b', activity('b', 1_800_000_000_000));
    h.reads.length = 0;
    expect((await h.index.getAll()).map((s) => s.id)).toEqual(['b', 'a']);
    expect(h.reads).toEqual(['b']);
  });

  it('drops summaries of deleted activities', async () => {
    const h = harness([activity('a', 1_700_000_000_000), activity('b', 1_800_000_000_000)]);
    await h.index.getAll();
    h.store.delete('a');
    expect((await h.index.getAll()).map((s) => s.id)).toEqual(['b']);
  });

  it('recomputes entries produced by another metrics version', async () => {
    const h = harness([activity('a', 1_700_000_000_000)]);
    await h.index.getAll();
    const data = JSON.parse(h.kv.map.get(SUMMARIES_KEY)!);
    data.items.a.version = 'metrics-m0';
    h.kv.map.set(SUMMARIES_KEY, JSON.stringify(data));
    h.reads.length = 0;
    const all = await h.index.getAll();
    expect(all[0].version).toBe(METRICS_VERSION);
    expect(h.reads).toEqual(['a']);
  });

  it('recovers from a corrupted index', async () => {
    const h = harness([activity('a', 1_700_000_000_000)]);
    h.kv.map.set(SUMMARIES_KEY, '{not json');
    expect((await h.index.getAll()).map((s) => s.id)).toEqual(['a']);
    h.kv.map.set(SUMMARIES_KEY, JSON.stringify({ version: 99, items: [] }));
    expect((await h.index.getAll()).map((s) => s.id)).toEqual(['a']);
  });

  it('clear is a complete rollback and never touches the activities', async () => {
    const h = harness([activity('a', 1_700_000_000_000)]);
    await h.index.getAll();
    await h.index.clear();
    expect(h.kv.map.has(SUMMARIES_KEY)).toBe(false);
    expect(h.store.has('a')).toBe(true);
    expect((await h.index.getAll()).length).toBe(1);
  });

  it('serializes concurrent upserts without losing entries', async () => {
    const h = harness([]);
    await Promise.all([
      h.index.upsert(activity('a', 1_700_000_000_000)),
      h.index.upsert(activity('b', 1_800_000_000_000)),
      h.index.upsert(activity('c', 1_900_000_000_000)),
    ]);
    const data = JSON.parse(h.kv.map.get(SUMMARIES_KEY)!);
    expect(Object.keys(data.items).sort()).toEqual(['a', 'b', 'c']);
  });

  it('ignores unfinished activities', async () => {
    const h = harness([]);
    await h.index.upsert(makeActivity('x', makeRun({ legs: [{ speed: 3, meters: 300 }] }), { status: 'started', endTime: null }));
    expect(h.kv.map.has(SUMMARIES_KEY)).toBe(false);
  });
});

describe('ActivityStorageService summaries', () => {
  beforeEach(async () => {
    await (AsyncStorage as unknown as { clear: () => Promise<void> }).clear();
  });

  it('keeps summaries in sync with save and delete and never alters the saved activity', async () => {
    const service = new ActivityStorageService();
    const a = activity('s1', 1_700_000_000_000);
    await service.saveActivity(a);
    const rawBefore = await AsyncStorage.getItem('NOMA_ACTIVITY_s1');

    expect((await service.getSummaries()).map((s) => s.id)).toEqual(['s1']);
    expect(await AsyncStorage.getItem('NOMA_ACTIVITY_s1')).toBe(rawBefore);

    await service.deleteActivity('s1');
    expect(await service.getSummaries()).toEqual([]);
  });

  it('rebuilds the summaries of activities saved before the index existed', async () => {
    const service = new ActivityStorageService();
    await service.saveActivity(activity('legacy', 1_700_000_000_000));
    await service.clearSummaries(); // simulates data from a version without the index
    const all = await service.getSummaries();
    expect(all).toHaveLength(1);
    expect(all[0].distanceM).toBeGreaterThan(590);
  });

  it('lists ids without reading activities', async () => {
    const service = new ActivityStorageService();
    await service.saveActivity(activity('i1', 1_700_000_000_000));
    await service.saveActivity(activity('i2', 1_800_000_000_000));
    expect((await service.listActivityIds()).sort()).toEqual(['i1', 'i2']);
  });
});
