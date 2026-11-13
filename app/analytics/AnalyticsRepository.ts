/**
 * Analytics persistence. Records, achievements and segments live in their own
 * versioned AsyncStorage keys; activities remain the single source of truth and
 * are never modified. On load, any finished activity that has not been analyzed
 * yet (old saved activities, or an app killed before analysis) is analyzed in
 * chronological order, so existing data is backward compatible.
 *
 * `AnalyticsSyncAdapter` is the seam for a future backend synchronization.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Activity } from '../types';
import {
  PersonalRecordsStore,
  PRAnalysisResult,
  analyzeActivity,
  emptyRecordsStore,
} from './personalRecords';
import {
  SegmentAnalysisResult,
  SegmentStore,
  analyzeSegments,
  emptySegmentStore,
} from './segments';

export const RECORDS_KEY = 'NOMA_ANALYTICS_RECORDS_V1';
export const SEGMENTS_KEY = 'NOMA_ANALYTICS_SEGMENTS_V1';

export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export interface AnalyticsSnapshot {
  records: PersonalRecordsStore;
  segments: SegmentStore;
}

/** Future backend sync: implement and pass to the repository. Not used yet. */
export interface AnalyticsSyncAdapter {
  push(snapshot: AnalyticsSnapshot): Promise<void>;
  pull?(): Promise<AnalyticsSnapshot | null>;
}

export interface ProcessResult {
  records: PRAnalysisResult;
  segments: SegmentAnalysisResult;
}

type ActivityLoader = () => Promise<Activity[]>;

const isRecordsStore = (v: unknown): v is PersonalRecordsStore =>
  !!v &&
  (v as PersonalRecordsStore).version === 1 &&
  Array.isArray((v as PersonalRecordsStore).history) &&
  Array.isArray((v as PersonalRecordsStore).processedActivityIds) &&
  Array.isArray((v as PersonalRecordsStore).achievements);

const isSegmentStore = (v: unknown): v is SegmentStore =>
  !!v &&
  (v as SegmentStore).version === 1 &&
  Array.isArray((v as SegmentStore).segments) &&
  Array.isArray((v as SegmentStore).attempts) &&
  Array.isArray((v as SegmentStore).processedActivityIds);

export class AnalyticsRepository {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly kv: KeyValueStore,
    private readonly loadActivities: ActivityLoader,
    private readonly sync?: AnalyticsSyncAdapter,
    /** Optional: lets the backfill skip loading activities (and their GPS points) when nothing is new. */
    private readonly listIds?: () => Promise<string[]>
  ) {}

  /** Serializes operations so concurrent calls cannot corrupt the stores. */
  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async read<T>(key: string, guard: (v: unknown) => v is T, empty: () => T): Promise<T> {
    try {
      const raw = await this.kv.getItem(key);
      if (!raw) return empty();
      const parsed: unknown = JSON.parse(raw);
      // Unknown / corrupted version: start empty, it is rebuilt from activities.
      return guard(parsed) ? parsed : empty();
    } catch {
      return empty();
    }
  }

  async load(): Promise<AnalyticsSnapshot> {
    return this.enqueue(() => this.loadUnsafe());
  }

  private async loadUnsafe(): Promise<AnalyticsSnapshot> {
    return {
      records: await this.read(RECORDS_KEY, isRecordsStore, emptyRecordsStore),
      segments: await this.read(SEGMENTS_KEY, isSegmentStore, emptySegmentStore),
    };
  }

  private async save(snapshot: AnalyticsSnapshot): Promise<void> {
    await this.kv.setItem(RECORDS_KEY, JSON.stringify(snapshot.records));
    await this.kv.setItem(SEGMENTS_KEY, JSON.stringify(snapshot.segments));
    if (this.sync) {
      try {
        await this.sync.push(snapshot);
      } catch (error) {
        console.warn('[Analytics] sync push failed:', error);
      }
    }
  }

  /** Analyzes one finished activity against everything saved before it. */
  processActivity(activity: Activity): Promise<ProcessResult> {
    return this.enqueue(async () => {
      const snapshot = await this.loadUnsafe();
      const history = (await this.loadActivities()).filter((a) => a.id !== activity.id);
      const { result, next } = this.analyzeOne(activity, history, snapshot);
      await this.save(next);
      return result;
    });
  }

  /** Backfills analytics for every finished activity not yet analyzed. */
  syncAll(): Promise<AnalyticsSnapshot> {
    return this.enqueue(async () => {
      let snapshot = await this.loadUnsafe();
      if (this.listIds) {
        const recordsDone = new Set(snapshot.records.processedActivityIds);
        const segmentsDone = new Set(snapshot.segments.processedActivityIds);
        const ids = await this.listIds();
        if (ids.every((id) => recordsDone.has(id) && segmentsDone.has(id))) return snapshot;
      }
      const all = (await this.loadActivities())
        .filter((a) => a.status === 'finished')
        .sort((a, b) => a.startTime - b.startTime);

      let changed = false;
      for (const activity of all) {
        const analyzed =
          snapshot.records.processedActivityIds.includes(activity.id) &&
          snapshot.segments.processedActivityIds.includes(activity.id);
        if (analyzed) continue;
        // Only earlier activities count as history so backfill matches live behavior.
        const history = all.filter((a) => a.startTime < activity.startTime);
        snapshot = this.analyzeOne(activity, history, snapshot).next;
        changed = true;
      }
      if (changed) await this.save(snapshot);
      return snapshot;
    });
  }

  private analyzeOne(
    activity: Activity,
    history: Activity[],
    snapshot: AnalyticsSnapshot
  ): { result: ProcessResult; next: AnalyticsSnapshot } {
    let records: PRAnalysisResult = { store: snapshot.records, newRecords: [], achievements: [] };
    let segments: SegmentAnalysisResult = {
      store: snapshot.segments,
      newSegments: [],
      attempts: [],
      personalBests: [],
    };
    // Each engine is isolated: a failure in one never affects the other or the activity.
    try {
      records = analyzeActivity(activity, snapshot.records);
    } catch (error) {
      console.warn('[Analytics] PR analysis failed:', error);
    }
    try {
      segments = analyzeSegments(activity, history, snapshot.segments);
    } catch (error) {
      console.warn('[Analytics] Segment analysis failed:', error);
    }
    return {
      result: { records, segments },
      next: { records: records.store, segments: segments.store },
    };
  }
}

let defaultRepository: AnalyticsRepository | null = null;

/** App-wide repository backed by AsyncStorage and the activity storage service. */
export function getAnalyticsRepository(
  loadActivities: ActivityLoader,
  listIds?: () => Promise<string[]>
): AnalyticsRepository {
  if (!defaultRepository) {
    defaultRepository = new AnalyticsRepository(AsyncStorage, loadActivities, undefined, listIds);
  }
  return defaultRepository;
}
