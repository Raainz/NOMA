import { groupByDay, parseDistance, PlannedRun, reminderDate, splitRuns, validateDraft } from '../app/plan/plannedRuns';

const H = 3_600_000;
const NOW = new Date(2026, 5, 10, 12, 0, 0).getTime();

const run = (id: string, startsAt: number, extra: Partial<PlannedRun> = {}): PlannedRun => ({
  id,
  title: id,
  startsAt,
  distanceKm: null,
  reminderMinutes: null,
  notificationId: null,
  completed: false,
  createdAt: NOW,
  ...extra,
});

describe('plannedRuns', () => {
  it('validates drafts', () => {
    const ok = { title: 'Fractionné', startsAt: NOW + H, distanceKm: 8, reminderMinutes: 60 };
    expect(validateDraft(ok, NOW)).toBeNull();
    expect(validateDraft({ ...ok, title: '  ' }, NOW)).toMatch(/titre/);
    expect(validateDraft({ ...ok, startsAt: NOW - 1 }, NOW)).toMatch(/futur/);
    expect(validateDraft({ ...ok, distanceKm: 0 }, NOW)).toMatch(/distance/);
    expect(validateDraft({ ...ok, distanceKm: 999 }, NOW)).toMatch(/distance/);
    expect(validateDraft({ ...ok, distanceKm: null }, NOW)).toBeNull();
  });

  it('parses distances', () => {
    expect(parseDistance('')).toBeNull();
    expect(parseDistance('10,5')).toBe(10.5);
    expect(parseDistance('12')).toBe(12);
    expect(Number.isNaN(parseDistance('abc'))).toBe(true);
    expect(Number.isNaN(parseDistance('-3'))).toBe(true);
  });

  it('computes reminder dates and ignores past ones', () => {
    expect(reminderDate({ startsAt: NOW + 2 * H, reminderMinutes: 60 }, NOW)?.getTime()).toBe(NOW + H);
    expect(reminderDate({ startsAt: NOW + 30 * 60_000, reminderMinutes: 60 }, NOW)).toBeNull();
    expect(reminderDate({ startsAt: NOW + 2 * H, reminderMinutes: null }, NOW)).toBeNull();
  });

  it('splits upcoming and past, sorted', () => {
    const runs = [run('b', NOW + 5 * H), run('a', NOW + H), run('old', NOW - H), run('done', NOW + 9 * H, { completed: true })];
    const { upcoming, past } = splitRuns(runs, NOW);
    expect(upcoming.map((r) => r.id)).toEqual(['a', 'b']);
    expect(past.map((r) => r.id)).toEqual(['done', 'old']);
  });

  it('groups by local day', () => {
    const groups = groupByDay([run('x', NOW + H), run('y', NOW + 2 * H), run('z', NOW + 30 * H)]);
    expect(groups).toHaveLength(2);
    expect(groups[0].runs.map((r) => r.id)).toEqual(['x', 'y']);
  });
});
