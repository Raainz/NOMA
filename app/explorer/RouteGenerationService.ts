/**
 * Route generation contract for the Explorer tab.
 * No generation backend exists yet: the default implementation honestly reports
 * "unavailable". A real implementation can be plugged in via `routeGenerator`.
 */

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export type RouteShape = 'loop' | 'out-and-back';
export type ReliefPreference = 'flat' | 'hilly';

export interface RouteRequest {
  start: Coordinate;
  distanceKm: number;
  shape: RouteShape;
  relief: ReliefPreference;
}

export interface GeneratedRoute {
  id: string;
  distanceKm: number;
  elevationGainM: number;
  path: Coordinate[];
}

export type RouteGenerationResult =
  | { status: 'ok'; routes: GeneratedRoute[] }
  | { status: 'unavailable' }
  | { status: 'no-result' }
  | { status: 'error'; message: string };

export interface RouteGenerator {
  generate(request: RouteRequest): Promise<RouteGenerationResult>;
}

export const unavailableGenerator: RouteGenerator = {
  async generate() {
    return { status: 'unavailable' };
  },
};

/** Swap this for a real implementation once a route service exists. */
export let routeGenerator: RouteGenerator = unavailableGenerator;

export function setRouteGenerator(generator: RouteGenerator) {
  routeGenerator = generator;
}

export const DISTANCE_OPTIONS_KM = [5, 10, 15, 21];
