/**
 * Regression tests for the existing recording core (must keep working unchanged).
 */
import * as Location from 'expo-location';
import { GPSTrackingService } from '../app/services/GPSTrackingService';
import { StatisticsService } from '../app/services/StatisticsService';
import { ActivityStorageService } from '../app/services/ActivityStorageService';
import { makeActivity, makeRun } from './helpers/gps';

jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
jest.mock('expo-location', () => ({
  Accuracy: { High: 4, BestForNavigation: 6 },
  ActivityType: { Fitness: 3 },
  requestForegroundPermissionsAsync: jest.fn(),
  requestBackgroundPermissionsAsync: jest.fn(async () => ({ status: 'denied' })),
  getForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  startLocationUpdatesAsync: jest.fn(),
  stopLocationUpdatesAsync: jest.fn(),
  hasStartedLocationUpdatesAsync: jest.fn(async () => false),
  watchPositionAsync: jest.fn(),
}));
jest.mock('../app/services/BackgroundLocationTask', () => ({
  BACKGROUND_TRACKING_TASK: 'test-task',
  setBackgroundLocationListener: jest.fn(),
}));

const loc = (lat: number, accuracy: number, t: number) =>
  ({
    coords: { latitude: lat, longitude: 2, altitude: 30, accuracy, speed: 3, heading: 0, altitudeAccuracy: 1 },
    timestamp: t,
  }) as unknown as Location.LocationObject;

describe('GPSTrackingService filtering', () => {
  it('keeps accurate, spaced points and drops noisy or redundant ones', async () => {
    let callback: (l: Location.LocationObject) => void = () => undefined;
    (Location.watchPositionAsync as jest.Mock).mockImplementation(async (_o, cb) => {
      callback = cb;
      return { remove: jest.fn() };
    });
    const points: unknown[] = [];
    const service = new GPSTrackingService();
    await service.startTracking((p) => points.push(p), jest.fn());

    callback(loc(48.0, 90, 1000)); // first fix accepted up to 100 m
    callback(loc(48.0002, 60, 2000)); // accuracy > 50: dropped
    callback(loc(48.000001, 5, 3000)); // < 5 m from last: dropped
    callback(loc(48.0002, 5, 4000)); // accepted
    expect(points).toHaveLength(2);
  });
});

describe('StatisticsService', () => {
  it('computes distance, pace and stats from GPS points', () => {
    const pts = makeRun({ legs: [{ speed: 4, meters: 1000 }], accuracy: 5 });
    expect(StatisticsService.calculateTotalDistance(pts)).toBeGreaterThan(0.99);
    expect(StatisticsService.calculatePace(1, 300_000)).toBeCloseTo(5);
    expect(StatisticsService.calculatePace(0, 300_000)).toBeNull();
  });
});

describe('ActivityStorageService backward compatibility', () => {
  it('saves, loads, lists and deletes activities', async () => {
    const service = new ActivityStorageService();
    const a = makeActivity('legacy-1', makeRun({ legs: [{ speed: 4, meters: 300 }] }));
    await service.saveActivity(a);
    expect((await service.getActivity('legacy-1'))!.id).toBe('legacy-1');
    expect((await service.getAllActivities()).map((x) => x.id)).toContain('legacy-1');
    await service.deleteActivity('legacy-1');
    expect(await service.getActivity('legacy-1')).toBeNull();
  });
});
