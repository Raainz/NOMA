/**
 * Activity Storage Service
 * Handles local persistence of activities using AsyncStorage
 * Provides recovery from crashes and activity history
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Activity } from '../types';
import { ActivitySummary } from '../analytics/metrics';
import { ActivitySummaryIndex } from '../analytics/summaryIndex';

const STORAGE_KEY_PREFIX = 'NOMA_ACTIVITY_';
const STORAGE_INDEX_KEY = 'NOMA_ACTIVITIES_INDEX';
const CURRENT_ACTIVITY_KEY = 'NOMA_CURRENT_ACTIVITY';

export class ActivityStorageService {
  /** Derived per-activity summaries (see analytics/summaryIndex.ts). Rebuildable, never authoritative. */
  private readonly summaries = new ActivitySummaryIndex(AsyncStorage, {
    listIds: () => this.getIndex(),
    getActivity: (id) => this.getActivity(id),
  });

  /** Ids of every saved activity, without reading any activity. */
  listActivityIds(): Promise<string[]> {
    return this.getIndex();
  }

  private readonly listeners = new Set<() => void>();

  /** Calls `listener` after every save or delete. Returns the unsubscribe function. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (error) {
        console.warn('[ActivityStorage] listener failed:', error);
      }
    });
  }

  /** Summaries of all saved activities, newest first. Reads no GPS point when the index is complete. */
  getSummaries(): Promise<ActivitySummary[]> {
    return this.summaries.getAll();
  }

  /** Drops the derived summaries (rollback); they are rebuilt on the next read. */
  clearSummaries(): Promise<void> {
    return this.summaries.clear();
  }

  /**
   * Save an activity to persistent storage
   */
  async saveActivity(activity: Activity): Promise<void> {
    try {
      const key = `${STORAGE_KEY_PREFIX}${activity.id}`;

      // Save the activity
      await AsyncStorage.setItem(key, JSON.stringify(activity));

      // Update the index
      await this.addToIndex(activity.id);

      // Derived data: a failure here must never affect the saved activity.
      await this.summaries.upsert(activity).catch((e) => console.warn('[ActivityStorage] summary failed:', e));
      this.notify();

      console.log(`[ActivityStorage] Saved activity: ${activity.id}`);
    } catch (error) {
      console.error('[ActivityStorage] Error saving activity:', error);
      throw error;
    }
  }

  /**
   * Save current activity for recovery in case of crash
   */
  async saveCurrentActivity(activity: Activity | null): Promise<void> {
    try {
      if (activity) {
        await AsyncStorage.setItem(CURRENT_ACTIVITY_KEY, JSON.stringify(activity));
      } else {
        await AsyncStorage.removeItem(CURRENT_ACTIVITY_KEY);
      }
    } catch (error) {
      console.error('[ActivityStorage] Error saving current activity:', error);
    }
  }

  /**
   * Recover current activity after crash
   */
  async recoverCurrentActivity(): Promise<Activity | null> {
    try {
      const data = await AsyncStorage.getItem(CURRENT_ACTIVITY_KEY);
      if (data) {
        return JSON.parse(data) as Activity;
      }
      return null;
    } catch (error) {
      console.error('[ActivityStorage] Error recovering activity:', error);
      return null;
    }
  }

  /**
   * Get a specific activity by ID
   */
  async getActivity(activityId: string): Promise<Activity | null> {
    try {
      const key = `${STORAGE_KEY_PREFIX}${activityId}`;
      const data = await AsyncStorage.getItem(key);
      if (data) {
        return JSON.parse(data) as Activity;
      }
      return null;
    } catch (error) {
      console.error('[ActivityStorage] Error getting activity:', error);
      return null;
    }
  }

  /**
   * Get all saved activities
   */
  async getAllActivities(): Promise<Activity[]> {
    try {
      const index = await this.getIndex();
      const activities: Activity[] = [];

      for (const activityId of index) {
        const activity = await this.getActivity(activityId);
        if (activity) {
          activities.push(activity);
        }
      }

      // Sort by start time (newest first)
      activities.sort((a, b) => b.startTime - a.startTime);

      return activities;
    } catch (error) {
      console.error('[ActivityStorage] Error getting all activities:', error);
      return [];
    }
  }

  /**
   * Delete an activity
   */
  async deleteActivity(activityId: string): Promise<void> {
    try {
      const key = `${STORAGE_KEY_PREFIX}${activityId}`;
      await AsyncStorage.removeItem(key);
      await this.removeFromIndex(activityId);
      await this.summaries.remove(activityId).catch(() => undefined);
      this.notify();

      console.log(`[ActivityStorage] Deleted activity: ${activityId}`);
    } catch (error) {
      console.error('[ActivityStorage] Error deleting activity:', error);
      throw error;
    }
  }

  /**
   * Get activity count
   */
  async getActivityCount(): Promise<number> {
    try {
      const index = await this.getIndex();
      return index.length;
    } catch (error) {
      console.error('[ActivityStorage] Error getting activity count:', error);
      return 0;
    }
  }

  /**
   * Clear all activities (use with caution)
   */
  async clearAllActivities(): Promise<void> {
    try {
      const activities = await this.getAllActivities();
      for (const activity of activities) {
        await this.deleteActivity(activity.id);
      }

      console.log('[ActivityStorage] Cleared all activities');
    } catch (error) {
      console.error('[ActivityStorage] Error clearing activities:', error);
      throw error;
    }
  }

  /**
   * Get storage usage statistics
   */
  async getStorageStats(): Promise<{ totalActivities: number; totalSize: number }> {
    try {
      const activities = await this.getAllActivities();
      let totalSize = 0;

      for (const activity of activities) {
        totalSize += JSON.stringify(activity).length;
      }

      return {
        totalActivities: activities.length,
        totalSize, // in bytes
      };
    } catch (error) {
      console.error('[ActivityStorage] Error getting storage stats:', error);
      return { totalActivities: 0, totalSize: 0 };
    }
  }

  /**
   * Update the index of activity IDs
   */
  private async getIndex(): Promise<string[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_INDEX_KEY);
      if (data) {
        return JSON.parse(data) as string[];
      }
      return [];
    } catch (error) {
      console.warn('[ActivityStorage] Error reading index:', error);
      return [];
    }
  }

  /**
   * Add an activity ID to the index
   */
  private async addToIndex(activityId: string): Promise<void> {
    try {
      const index = await this.getIndex();
      if (!index.includes(activityId)) {
        index.push(activityId);
        await AsyncStorage.setItem(STORAGE_INDEX_KEY, JSON.stringify(index));
      }
    } catch (error) {
      console.warn('[ActivityStorage] Error adding to index:', error);
    }
  }

  /**
   * Remove an activity ID from the index
   */
  private async removeFromIndex(activityId: string): Promise<void> {
    try {
      const index = await this.getIndex();
      const filtered = index.filter(id => id !== activityId);
      await AsyncStorage.setItem(STORAGE_INDEX_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.warn('[ActivityStorage] Error removing from index:', error);
    }
  }
}

// Singleton instance
export const activityStorageService = new ActivityStorageService();
