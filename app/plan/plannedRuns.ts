/**
 * Planned runs: data model and pure helpers (no storage, no notifications).
 */

export interface PlannedRun {
  id: string;
  title: string;
  /** Start time, epoch ms. */
  startsAt: number;
  distanceKm: number | null;
  /** Minutes before startsAt at which the reminder fires; null = no reminder. */
  reminderMinutes: number | null;
  /** Id of the scheduled local notification, if any. */
  notificationId: string | null;
  completed: boolean;
  createdAt: number;
}

export interface PlannedRunDraft {
  title: string;
  startsAt: number;
  distanceKm: number | null;
  reminderMinutes: number | null;
}

export const REMINDER_OPTIONS: { label: string; minutes: number | null }[] = [
  { label: 'Aucun', minutes: null },
  { label: '15 min avant', minutes: 15 },
  { label: '1 h avant', minutes: 60 },
  { label: 'La veille', minutes: 24 * 60 },
];

export const MAX_TITLE_LENGTH = 60;
export const MAX_DISTANCE_KM = 250;

/** Date at which the reminder should fire, or null if none / already in the past. */
export function reminderDate(
  run: Pick<PlannedRun, 'startsAt' | 'reminderMinutes'>,
  now: number = Date.now()
): Date | null {
  if (run.reminderMinutes === null) return null;
  const at = run.startsAt - run.reminderMinutes * 60_000;
  return at > now ? new Date(at) : null;
}

/** Returns an error message (French, user-facing) or null when the draft is valid. */
export function validateDraft(draft: PlannedRunDraft, now: number = Date.now()): string | null {
  if (!draft.title.trim()) return 'Donnez un titre à votre sortie.';
  if (draft.title.trim().length > MAX_TITLE_LENGTH) return `Le titre est limité à ${MAX_TITLE_LENGTH} caractères.`;
  if (draft.startsAt <= now) return 'Choisissez un horaire dans le futur.';
  if (draft.distanceKm !== null && (!isFinite(draft.distanceKm) || draft.distanceKm <= 0 || draft.distanceKm > MAX_DISTANCE_KM)) {
    return `La distance doit être comprise entre 0 et ${MAX_DISTANCE_KM} km.`;
  }
  return null;
}

/** Parses a user-entered distance ("10", "10,5"). Empty -> null, invalid -> NaN. */
export function parseDistance(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (!t) return null;
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
}

export function sortByDate(runs: PlannedRun[]): PlannedRun[] {
  return [...runs].sort((a, b) => a.startsAt - b.startsAt);
}

/** Upcoming = not completed and not started yet (ascending). Past = everything else (most recent first). */
export function splitRuns(runs: PlannedRun[], now: number = Date.now()) {
  const upcoming = sortByDate(runs.filter((r) => !r.completed && r.startsAt > now));
  const past = sortByDate(runs.filter((r) => r.completed || r.startsAt <= now)).reverse();
  return { upcoming, past };
}

export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function groupByDay(runs: PlannedRun[]): { key: string; date: number; runs: PlannedRun[] }[] {
  const groups: { key: string; date: number; runs: PlannedRun[] }[] = [];
  for (const run of sortByDate(runs)) {
    const key = dayKey(run.startsAt);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.runs.push(run);
    else groups.push({ key, date: run.startsAt, runs: [run] });
  }
  return groups;
}

/** Local midnight of the given day plus the given offset in days. */
export function startOfDay(ts: number, offsetDays = 0): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d.getTime();
}
