import { ApiError, SyncPayload } from '../app/api/client';
import { backoffMs, buildSyncPayload, countStates, SyncService, SyncState } from '../app/sync/syncQueue';
import { Activity } from '../app/types';

function activity(id: string, start = 1_780_000_000_000, nPoints = 10, over: Partial<Activity> = {}): Activity {
  return {
    id,
    name: 'Sortie',
    status: 'finished',
    startTime: start,
    endTime: start + 60_000,
    gpsPoints: Array.from({ length: nPoints }, (_, i) => ({
      latitude: 36.8 + i * 0.0001,
      longitude: 10.18,
      altitude: 10,
      accuracy: 5,
      speed: 3,
      timestamp: start + i * 1000,
    })),
    stats: {
      totalDistance: 1.2,
      totalDuration: 60_000,
      movingTime: 58_000,
      averagePace: 5,
      currentPace: null,
      averageSpeed: 12,
      currentSpeed: null,
      elevationGain: 4,
      maxSpeed: 14,
    },
    ...over,
  };
}

function harness(activities: Activity[], upload: (p: SyncPayload) => Promise<any>, initial: SyncState = {}) {
  let saved: SyncState = initial;
  let now = 1_000_000;
  const service = new SyncService({
    storage: { load: async () => JSON.parse(JSON.stringify(saved)), save: async (s) => void (saved = JSON.parse(JSON.stringify(s))) },
    upload,
    listActivities: async () => activities,
    now: () => now,
  });
  return { service, state: () => saved, advance: (ms: number) => void (now += ms) };
}

const ok = (id = 'srv') => async () => ({ status: 201, activity: { id, client_activity_id: 'x' } });

describe('buildSyncPayload', () => {
  it('maps fields, converts units and uses ISO UTC dates', () => {
    const p = buildSyncPayload(activity('a1'))!;
    expect(p.client_activity_id).toBe('a1');
    expect(p.started_at).toBe(new Date(1_780_000_000_000).toISOString());
    expect(p.points).toHaveLength(10);
    expect(p.client_metrics!.distance_m).toBeCloseTo(1200);
  });

  it('sanitises values the server would reject', () => {
    const a = activity('a2');
    a.gpsPoints[0] = { ...a.gpsPoints[0], speed: -1, accuracy: -1, altitude: 99999 };
    a.gpsPoints[1] = { ...a.gpsPoints[1], latitude: 200 };
    const p = buildSyncPayload(a)!;
    expect(p.points).toHaveLength(9);
    expect(p.points.every((pt) => pt.speed === null || pt.speed >= 0)).toBe(true);
    expect(p.points[0].altitude).toBeNull();
  });

  it('sorts points and rejects traces that are too short or unfinished', () => {
    const a = activity('a3');
    a.gpsPoints.reverse();
    const ts = buildSyncPayload(a)!.points.map((p) => p.timestamp);
    expect(ts).toEqual([...ts].sort((x, y) => x - y));
    expect(buildSyncPayload(activity('a4', undefined, 1))).toBeNull();
    expect(buildSyncPayload(activity('a5', undefined, 10, { status: 'paused', endTime: null }))).toBeNull();
  });
});

describe('SyncService', () => {
  it('uploads finished activities oldest first and marks them synced', async () => {
    const order: string[] = [];
    const h = harness([activity('new', 2_000_000_000_000), activity('old', 1_000_000_000_000)], async (p) => {
      order.push(p.client_activity_id);
      return { status: 201, activity: { id: 'srv-' + p.client_activity_id, client_activity_id: p.client_activity_id } };
    });
    await h.service.run();
    expect(order).toEqual(['old', 'new']);
    expect(h.state().old).toMatchObject({ status: 'synced', serverId: 'srv-old' });
  });

  it('does not re-upload synced activities', async () => {
    const upload = jest.fn(ok());
    const h = harness([activity('a')], upload);
    await h.service.run();
    await h.service.run();
    expect(upload).toHaveBeenCalledTimes(1);
  });

  it('stays pending with backoff when offline, and stops the pass', async () => {
    const upload = jest.fn().mockRejectedValue(new ApiError(0, 'network_error', 'offline'));
    const h = harness([activity('a', 1), activity('b', 2)], upload);
    await h.service.run();
    expect(upload).toHaveBeenCalledTimes(1);
    expect(h.state().a).toMatchObject({ status: 'pending', attempts: 1 });

    await h.service.run(); // too early for 'a': backoff not elapsed
    expect(upload.mock.calls.filter((c: any[]) => c[0].client_activity_id === 'a')).toHaveLength(1);

    h.advance(backoffMs(1) + 1);
    upload.mockImplementation(ok());
    await h.service.run();
    expect(h.state().a.status).toBe('synced');
    expect(h.state().b.status).toBe('synced');
  });

  it('force ignores the backoff window', async () => {
    const upload = jest.fn().mockRejectedValueOnce(new ApiError(503, 'x', 'down')).mockImplementation(ok());
    const h = harness([activity('a')], upload);
    await h.service.run();
    await h.service.run({ force: true });
    expect(h.state().a.status).toBe('synced');
  });

  it('marks 409 and 422 as permanent failures and keeps going', async () => {
    const upload = jest.fn(async (p: SyncPayload) => {
      if (p.client_activity_id === 'bad') throw new ApiError(422, 'validation_error', 'invalid');
      if (p.client_activity_id === 'conflict') throw new ApiError(409, 'activity_conflict', 'conflict');
      return { status: 201, activity: { id: 's', client_activity_id: p.client_activity_id } };
    });
    const h = harness([activity('bad', 1), activity('conflict', 2), activity('good', 3)], upload);
    await h.service.run();
    expect(h.state().bad.status).toBe('failed');
    expect(h.state().conflict.status).toBe('failed');
    expect(h.state().good.status).toBe('synced');
    await h.service.run({ force: true });
    expect(upload).toHaveBeenCalledTimes(3); // failed ones are not retried automatically
  });

  it('retryFailed puts failures back in the queue', async () => {
    const upload = jest.fn().mockRejectedValueOnce(new ApiError(422, 'validation_error', 'invalid')).mockImplementation(ok());
    const h = harness([activity('a')], upload);
    await h.service.run();
    expect(h.state().a.status).toBe('failed');
    await h.service.retryFailed();
    await h.service.run();
    expect(h.state().a.status).toBe('synced');
  });

  it('fails permanently without calling the server when the trace is unusable', async () => {
    const upload = jest.fn(ok());
    const h = harness([activity('short', undefined, 1)], upload);
    await h.service.run();
    expect(upload).not.toHaveBeenCalled();
    expect(h.state().short.status).toBe('failed');
  });

  it('ignores overlapping runs', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const upload = jest.fn(async () => {
      await gate;
      return { status: 201, activity: { id: 's', client_activity_id: 'a' } };
    });
    const h = harness([activity('a')], upload);
    const first = h.service.run();
    const second = await h.service.run();
    expect(second.skipped).toBe(true);
    release();
    await first;
    expect(upload).toHaveBeenCalledTimes(1);
  });
});

describe('helpers', () => {
  it('lazy mode loads only the activities that still need an upload', async () => {
    const all = [activity('done', 1), activity('failed', 2), activity('todo', 3)];
    const getActivity = jest.fn(async (id: string) => all.find((a) => a.id === id) ?? null);
    const upload = jest.fn(ok());
    let saved: SyncState = {
      done: { status: 'synced', attempts: 1, nextAttemptAt: 0 },
      failed: { status: 'failed', attempts: 1, nextAttemptAt: 0 },
    };
    const listActivities = jest.fn(async () => all);
    const service = new SyncService({
      storage: { load: async () => JSON.parse(JSON.stringify(saved)), save: async (s) => void (saved = JSON.parse(JSON.stringify(s))) },
      upload,
      listActivities,
      listIds: async () => all.map((a) => a.id),
      getActivity,
    });
    await service.run();
    expect(listActivities).not.toHaveBeenCalled();
    expect(getActivity.mock.calls.map((c) => c[0])).toEqual(['todo']);
    expect(upload).toHaveBeenCalledTimes(1);
  });

  it('backoff grows and is capped', () => {
    expect(backoffMs(1)).toBe(15_000);
    expect(backoffMs(2)).toBe(30_000);
    expect(backoffMs(20)).toBe(30 * 60_000);
  });

  it('countStates treats unknown activities as pending', () => {
    const state: SyncState = { a: { status: 'synced', attempts: 1, nextAttemptAt: 0 } };
    expect(countStates(state, [activity('a'), activity('b')])).toEqual({ pending: 1, synced: 1, failed: 0 });
  });
});
