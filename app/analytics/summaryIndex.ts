/**
 * Persistent index of per-activity summaries (derived data).
 *
 * Lists, aggregates and charts read this one small key instead of loading every activity with its GPS
 * points. The index is rebuildable at any time from the saved activities, which are never modified:
 * deleting the key (`clear`) is a complete rollback.
 */

import { Activity } from '../types';
import { ActivitySummary, METRICS_VERSION, buildActivitySummary } from './metrics';

export const SUMMARIES_KEY = 'NOMA_ACTIVITY_SUMMARIES_V1';

export interface SummaryKeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface ActivitySource {
  listIds(): Promise<string[]>;
  getActivity(id: string): Promise<Activity | null>;
}

interface IndexData {
  version: 1;
  items: Record<string, ActivitySummary>;
}

const empty = (): IndexData => ({ version: 1, items: {} });

const isIndexData = (v: unknown): v is IndexData =>
  !!v &&
  (v as IndexData).version === 1 &&
  typeof (v as IndexData).items === 'object' &&
  (v as IndexData).items !== null &&
  !Array.isArray((v as IndexData).items);

export class ActivitySummaryIndex {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly kv: SummaryKeyValueStore,
    private readonly source: ActivitySource
  ) {}

  /** Serializes operations so concurrent saves and backfills cannot overwrite each other. */
  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async read(): Promise<IndexData> {
    try {
      const raw = await this.kv.getItem(SUMMARIES_KEY);
      if (!raw) return empty();
      const parsed: unknown = JSON.parse(raw);
      // Corrupted or unknown format: start empty, it is rebuilt from the activities.
      return isIndexData(parsed) ? parsed : empty();
    } catch {
      return empty();
    }
  }

  private write(data: IndexData): Promise<void> {
    return this.kv.setItem(SUMMARIES_KEY, JSON.stringify(data));
  }

  /** Adds or refreshes the summary of a saved activity. */
  upsert(activity: Activity): Promise<void> {
    return this.enqueue(async () => {
      const summary = buildActivitySummary(activity);
      if (!summary) return;
      const data = await this.read();
      data.items[activity.id] = summary;
      await this.write(data);
    });
  }

  remove(id: string): Promise<void> {
    return this.enqueue(async () => {
      const data = await this.read();
      if (!(id in data.items)) return;
      delete data.items[id];
      await this.write(data);
    });
  }

  /** Complete rollback: the activities themselves are untouched. */
  clear(): Promise<void> {
    return this.enqueue(() => this.kv.removeItem(SUMMARIES_KEY));
  }

  /**
   * All summaries, newest first. Missing or outdated entries are rebuilt from the saved activities
   * (only those are read); entries of deleted activities are dropped. With a complete index this
   * reads two small keys and no GPS point.
   */
  getAll(): Promise<ActivitySummary[]> {
    return this.enqueue(async () => {
      const ids = await this.source.listIds();
      const data = await this.read();
      let changed = false;

      const known = new Set(ids);
      for (const id of Object.keys(data.items)) {
        if (!known.has(id)) {
          delete data.items[id];
          changed = true;
        }
      }

      for (const id of ids) {
        const existing = data.items[id];
        if (existing && existing.version === METRICS_VERSION) continue;
        try {
          const activity = await this.source.getActivity(id);
          const summary = activity ? buildActivitySummary(activity) : null;
          if (summary) {
            data.items[id] = summary;
            changed = true;
          }
        } catch (error) {
          console.warn('[Summaries] could not summarize activity', id, error);
        }
      }

      if (changed) await this.write(data);
      return Object.values(data.items).sort((a, b) => b.startTime - a.startTime);
    });
  }
}
