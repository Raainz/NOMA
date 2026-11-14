import { cardStats, formatCardPace, formatCardTime, projectRoute, thin } from '../app/share/shareCard';

const line = (n: number) => Array.from({ length: n }, (_, i) => ({ latitude: 36.8 + i * 0.0001, longitude: 10.18 }));

describe('share card helpers', () => {
  it('formats time with and without hours', () => {
    expect(formatCardTime(42 * 60_000 + 10_000)).toBe('42:10');
    expect(formatCardTime(3_730_000)).toBe('1:02:10');
    expect(formatCardTime(-5)).toBe('0:00');
  });

  it('formats pace and handles rounding up to the next minute', () => {
    expect(formatCardPace(5.0167)).toBe(`5'01"`);
    expect(formatCardPace(4.999)).toBe(`5'00"`);
    expect(formatCardPace(null)).toBeNull();
    expect(formatCardPace(0)).toBeNull();
  });

  it('shows distance with a comma, and never a date or place', () => {
    const s = cardStats({ distanceM: 8420, movingMs: 2_530_000, avgPaceMinKm: 5.01 });
    expect(s).toEqual({ distance: '8,42', distanceUnit: 'km', time: '42:10', pace: `5'01"` });
    expect(Object.keys(s).sort()).toEqual(['distance', 'distanceUnit', 'pace', 'time']);
  });

  it('thins long traces but keeps both ends', () => {
    const t = thin(line(1000), 100);
    expect(t).toHaveLength(100);
    expect(t[0]).toEqual(line(1000)[0]);
    expect(t[99]).toEqual(line(1000)[999]);
    expect(thin(line(10), 100)).toHaveLength(10);
  });

  it('projects inside the box with the right orientation', () => {
    const r = projectRoute(line(50), 300, 300, 20)!;
    const nums = r.d.match(/-?\d+(\.\d+)?/g)!.map(Number);
    expect(Math.min(...nums)).toBeGreaterThanOrEqual(20 - 0.1);
    expect(Math.max(...nums)).toBeLessThanOrEqual(280 + 0.1);
    // Northbound run: the end is above (smaller y than) the start.
    expect(r.end.y).toBeLessThan(r.start.y);
  });

  it('keeps the real aspect ratio (a tall thin trace stays thin)', () => {
    const r = projectRoute(line(50), 400, 200, 10)!;
    const xs = r.d.match(/[ML](-?\d+(\.\d+)?) /g)!.map((m) => Number(m.slice(1)));
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(1);
  });

  it('returns null when there is nothing to draw', () => {
    expect(projectRoute([], 300, 300)).toBeNull();
    expect(projectRoute(line(1), 300, 300)).toBeNull();
    expect(projectRoute([{ latitude: 36.8, longitude: 10.18 }, { latitude: 36.8, longitude: 10.18 }], 300, 300)).toBeNull();
    expect(projectRoute([{ latitude: NaN, longitude: 1 }, { latitude: 2, longitude: 3 }], 300, 300)).toBeNull();
  });
});
