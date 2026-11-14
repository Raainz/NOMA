/**
 * Share card (spec section 13.1): pure helpers that turn a finished activity into what the card shows.
 * Deliberately no date, and no React / native imports so everything here is unit-testable.
 */

export interface LatLon {
  latitude: number;
  longitude: number;
}

export interface RoutePath {
  /** SVG path data ("M x y L x y ..."), already scaled and centred in the box. */
  d: string;
  start: { x: number; y: number };
  end: { x: number; y: number };
}

const MAX_POINTS = 240;

/** Evenly thins a long trace (always keeps the first and last point). */
export function thin<T>(items: T[], max: number = MAX_POINTS): T[] {
  if (items.length <= max) return items;
  const out: T[] = [];
  const step = (items.length - 1) / (max - 1);
  for (let i = 0; i < max; i++) out.push(items[Math.round(i * step)]);
  return out;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Projects a GPS trace into a width x height box with `padding`, keeping the real aspect ratio
 * (longitude is scaled by cos(latitude)). North is up. Returns null when there is nothing to draw.
 */
export function projectRoute(points: LatLon[], width: number, height: number, padding = 16): RoutePath | null {
  const pts = thin(points.filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude)));
  if (pts.length < 2) return null;

  const meanLat = pts.reduce((s, p) => s + p.latitude, 0) / pts.length;
  const kx = Math.cos((meanLat * Math.PI) / 180);
  const xs = pts.map((p) => p.longitude * kx);
  const ys = pts.map((p) => -p.latitude); // screen y grows downwards

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  if (spanX === 0 && spanY === 0) return null; // standing still

  const innerW = Math.max(width - 2 * padding, 1);
  const innerH = Math.max(height - 2 * padding, 1);
  const scale = Math.min(spanX > 0 ? innerW / spanX : Infinity, spanY > 0 ? innerH / spanY : Infinity);
  const offX = padding + (innerW - spanX * scale) / 2;
  const offY = padding + (innerH - spanY * scale) / 2;

  const proj = pts.map((_, i) => ({ x: round1(offX + (xs[i] - minX) * scale), y: round1(offY + (ys[i] - minY) * scale) }));
  const d = proj.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ');
  return { d, start: proj[0], end: proj[proj.length - 1] };
}

export interface CardStats {
  distance: string; // "8,42"
  distanceUnit: 'km';
  time: string; // "42:10" or "1:02:10"
  pace: string | null; // "5'01\"" per km, null when unknown
}

const pad2 = (n: number) => String(n).padStart(2, '0');

export function formatCardTime(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`;
}

export function formatCardPace(minPerKm: number | null): string | null {
  if (minPerKm === null || !Number.isFinite(minPerKm) || minPerKm <= 0) return null;
  let min = Math.floor(minPerKm);
  let sec = Math.round((minPerKm - min) * 60);
  if (sec === 60) {
    min += 1;
    sec = 0;
  }
  return `${min}'${pad2(sec)}"`;
}

/** The only numbers the card shows. No date, no location. */
export function cardStats(input: { distanceM: number; movingMs: number; avgPaceMinKm: number | null }): CardStats {
  const km = input.distanceM / 1000;
  return {
    distance: km.toFixed(2).replace('.', ','),
    distanceUnit: 'km',
    time: formatCardTime(input.movingMs),
    pace: formatCardPace(input.avgPaceMinKm),
  };
}
