# NOMA - Performance Intelligence

Analytics, records and segments are computed from saved activities. The GPS recording core
(`GPSTrackingService`, `BackgroundLocationTask`, `TrackingContext`, storage model) is unchanged.

## Architecture

```
app/analytics/            pure TypeScript, no React Native import (unit tested)
  track.ts                cleans GPS points, splits runs at gaps, cumulative distance/time
  efforts.ts              best effort on exact distance, km splits, elevation profile
  personalRecords.ts      PR engine, achievements, record history
  segments.ts             automatic personal segments, attempts, progression
  performance.ts          weekly/monthly volume, comparisons, frequency, filters
  AnalyticsRepository.ts  AsyncStorage persistence, backfill, serialized operations
app/context/AnalyticsContext.tsx   exposes stores to screens, `processActivity` after finish
app/hooks/useActivities.ts         reloads activities + backfills analytics on screen focus
```

Flow: `LiveTrackingScreen` calls `finishActivity()` (unchanged), then `processActivity(finished)`
inside a try/catch. An analytics failure never affects the saved activity. The result is passed
to the Summary screen to display new achievements.

## Track cleaning (`prepareTrack`)

- Points are sorted; accuracy > 50 m, speed spikes (> 10 m/s between samples) and non monotonic
  timestamps are discarded (re-anchoring after 5 consecutive rejections).
- A gap > 30 s starts a new continuous run: no distance or time is added across a pause or GPS loss.

## Personal records

- Distances: 1 km, 1 mile, 3 km, 5 km, 10 km, half marathon, marathon, plus longest activity.
- A record is the fastest continuous effort over EXACTLY the target distance, found with a sliding
  window with linear interpolation (not the best kilometre split). Efforts never cross a gap.
  Effort speeds above 8.5 m/s are ignored as GPS artefacts.
- Beating a record appends a new entry (history is append-only) with `previousValue`,
  `previousActivityId` and `improvement`; a first effort creates a `first_effort` achievement.
- Duplicate prevention: `processedActivityIds` plus the entry id `recordKey:activityId`.
  Unfinished activities are ignored (not marked processed); activities too short for any
  analysis are marked processed.

## Segments

- A segment is a section >= 400 m travelled in the same direction in at least two activities.
  Routes are resampled every 20 m; points match within 30 m, in order, with short misses bridged.
- An attempt is the fastest traversal of the segment in an activity (length within 15 %), with
  elapsed and moving time. Segment geometry is deduplicated by start/end/length.
- Personal only: no leaderboard, no network.

## Storage and migration

| Key | Content |
| --- | --- |
| `NOMA_ACTIVITY_<id>`, `NOMA_ACTIVITIES_INDEX`, `NOMA_CURRENT_ACTIVITY` | existing activities (unchanged) |
| `NOMA_ANALYTICS_RECORDS_V1` | `PersonalRecordsStore` (version 1) |
| `NOMA_ANALYTICS_SEGMENTS_V1` | `SegmentStore` (version 1) |

On start and on every screen focus `syncAll()` analyzes finished activities not yet analyzed, in
chronological order, so existing activities are migrated without any data change. Corrupted or
unknown-version stores are reset and rebuilt from activities. Deleting an activity does not delete
past records (they remain part of the personal history). `AnalyticsSyncAdapter` is the seam for a
future backend sync.

## Design system

Palette in `NOMA_COLORS` (`UIComponents.tsx`) follows the brand book: Carbon `#141916` (structure,
text), Sand `#F5F1E8` (backgrounds), Coral `#FF704F` (actions, CTA, GPS trace), Mediterranean
`#91C9D8` (exploration, maps), Lime `#B9F34A` (performance: data, records, primary buttons), Sea Green
`#267F7B` (secondary, elevation). Typography: Manrope (titles) and Inter (interface), loaded in
`App.tsx`. Signature elements: letter-spaced `Wordmark` and the short lime `AccentBar`. Legacy
colour keys are kept as aliases. Charts are plain Views (`components/Charts.tsx`), no chart dependency.

## Tests

```
npm test            # jest
npx tsc --noEmit
```

`__tests__/` covers exact-distance efforts, PR detection and duplicate prevention, record history,
pauses/gaps/GPS noise/incomplete activities, segment matching, performance aggregates, repository
backfill/corruption/concurrency, and regression tests for GPS filtering, statistics and storage.
