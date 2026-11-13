import { Activity, GPSPoint } from '../../app/types';

/** Meters per degree of latitude/longitude-at-equator for the haversine radius used by the app. */
export const M_PER_DEG = (6371008.8 * Math.PI) / 180;

export interface Leg {
  /** Meters per second. */
  speed: number;
  /** Meters covered in this leg. */
  meters: number;
}

export interface RunOptions {
  legs: Leg[];
  startTime?: number;
  startLat?: number;
  startLon?: number;
  /** 'north' moves along latitude, 'east' along longitude (at the equator). */
  heading?: 'north' | 'south' | 'east';
  intervalMs?: number;
  accuracy?: number;
  altitude?: (distance: number) => number | null;
  /** Deterministic lateral jitter in meters. */
  jitter?: number;
}

/** Builds GPS points for a straight run made of constant-speed legs. */
export function makeRun(opts: RunOptions): GPSPoint[] {
  const {
    legs,
    startTime = 1_700_000_000_000,
    startLat = 0,
    startLon = 0,
    heading = 'north',
    intervalMs = 1000,
    accuracy = 5,
    altitude = () => 100,
    jitter = 0,
  } = opts;

  const points: GPSPoint[] = [];
  let distance = 0;
  let time = startTime;
  let n = 0;

  const push = () => {
    const lateral = jitter ? Math.sin(n * 12.9898) * jitter : 0;
    const along = distance / M_PER_DEG;
    const side = lateral / M_PER_DEG;
    let lat = startLat;
    let lon = startLon;
    if (heading === 'north') {
      lat += along;
      lon += side;
    } else if (heading === 'south') {
      lat -= along;
      lon += side;
    } else {
      lon += along;
      lat += side;
    }
    points.push({
      latitude: lat,
      longitude: lon,
      altitude: altitude(distance),
      accuracy,
      timestamp: time,
      speed: null,
    });
    n++;
  };

  push();
  for (const leg of legs) {
    const stepM = leg.speed * (intervalMs / 1000);
    const steps = Math.round(leg.meters / stepM);
    for (let i = 0; i < steps; i++) {
      distance += stepM;
      time += intervalMs;
      push();
    }
  }
  return points;
}

/** Appends `gapMs` of pause before the given points (shifts their timestamps). */
export function shiftTime(points: GPSPoint[], deltaMs: number): GPSPoint[] {
  return points.map((p) => ({ ...p, timestamp: p.timestamp + deltaMs }));
}

export function makeActivity(
  id: string,
  gpsPoints: GPSPoint[],
  overrides: Partial<Activity> = {}
): Activity {
  const first = gpsPoints[0]?.timestamp ?? 1_700_000_000_000;
  const last = gpsPoints[gpsPoints.length - 1]?.timestamp ?? first;
  return {
    id,
    name: id,
    gpsPoints,
    stats: {
      totalDistance: 0,
      totalDuration: last - first,
      movingTime: last - first,
      averagePace: 0,
      currentPace: null,
      averageSpeed: 0,
      currentSpeed: null,
      elevationGain: 0,
      maxSpeed: 0,
    },
    startTime: first,
    endTime: last,
    status: 'finished',
    ...overrides,
  };
}

/** Activity with explicit stats and no GPS (for pure aggregate analytics). */
export function makeStatsActivity(
  id: string,
  startTime: number,
  distanceKm: number,
  durationMs: number
): Activity {
  return makeActivity(id, [], {
    startTime,
    endTime: startTime + durationMs,
    stats: {
      totalDistance: distanceKm,
      totalDuration: durationMs,
      movingTime: durationMs,
      averagePace: durationMs / 60000 / distanceKm,
      currentPace: null,
      averageSpeed: distanceKm / (durationMs / 3_600_000),
      currentSpeed: null,
      elevationGain: 0,
      maxSpeed: 0,
    },
  });
}
