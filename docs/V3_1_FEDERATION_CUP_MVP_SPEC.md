# Indian Olympic Dream - V3.1 Federation Cup MVP Spec

## 1) Purpose

This document defines the first live-results MVP for IOD after the V3.0 launch.

Target event:
- `29th National Senior Athletics Federation Competition`
- `Ranchi`
- `May 22-25, 2026`

Primary goal:
- publish live or near-live athletics results from the Payload admin panel to the event detail page during the competition window

This is intentionally a narrow MVP:
- one tournament
- one sport
- one publishing workflow
- one public page experience

---

## 2) Product Goal

Use the Federation Cup as the first proof that IOD can move from editorial event context to live event coverage.

The MVP should prove:
1. editors can update competition results from the admin panel without code changes
2. users can open the event page and see current results in a clean, trustworthy format
3. the existing `Calendar -> Event Detail` flow can become the home for future live tournament coverage

---

## 3) Scope

### In scope
1. Use the existing calendar event detail route as the public tournament page.
2. Add athletics-specific live results support to the event record in Payload.
3. Render session-wise discipline result tables on the public event detail page.
4. Support manual admin updates during the event.
5. Show clear live state:
   - not started
   - live
   - session complete
   - event complete
6. Show `last updated` timestamp on the public page.

### Out of scope
1. Universal live-results engine for all sports.
2. Fixture-by-fixture team-sport live scoring.
3. Federation API ingestion or automation.
4. Athlete detail page integration.
5. Notifications, follow, bookmarks, or push alerts.
6. Full statistics/history archive for every result row.
7. Separate `Tournament` frontend route for V3.1 MVP.

---

## 4) Why This Approach

We should not build the Federation Cup MVP on top of the current `Tournaments` / `Matches` model.

Reasons:
1. `CalendarEvents` already owns the public discovery and detail flow.
2. `Matches` is not mounted in the active Payload config.
3. athletics results are table-driven, not match-driven.
4. building a generic tournament platform first would slow down the MVP significantly.

So the MVP path is:
- keep Federation Cup as a `CalendarEvent`
- enrich that event with structured live results data
- render those results inside the existing event detail page

This is the smallest path to a public live test.

---

## 5) Public UX

### Entry points
1. `Calendar` page
2. `Athletics` sport detail page `Current` tab
3. direct share link to the event page

### Public route
- keep using the existing route:
  - `/calendar/:slug`

### Page structure
1. Existing hero remains:
   - title
   - date
   - location
   - event context
2. Add a new `Live Results` module below the hero.
3. If results are available, that module becomes the primary reason to visit the page.

### Recommended page sections
1. `Live status bar`
   - event state
   - current session label
   - last updated
2. `Today at Federation Cup`
   - session cards for the day
3. `Results`
   - grouped by session
   - grouped by discipline
4. `Highlights`
   - optional short editorial notes from admin
5. Existing context blocks
   - official link
   - why it matters
   - India watch

### Empty-state behavior
If the live module is enabled but no results are published yet:
- show session schedule
- show `Results will appear here once the competition begins`

---

## 6) CMS Model Recommendation

### Keep using
- `calendar-events`

### Add a new optional group on `CalendarEvents`
Suggested field: `liveCoverage`

### `liveCoverage` fields
1. `enabled`
   - checkbox
2. `coverageMode`
   - select
   - values:
     - `athletics_results`
3. `publicStatus`
   - select
   - values:
     - `not_started`
     - `live`
     - `between_sessions`
     - `completed`
4. `lastUpdatedAt`
   - date
5. `liveNote`
   - textarea
6. `resultsSourceLabel`
   - text
7. `resultsSourceUrl`
   - text

### `liveCoverage.sessions`
Array of session groups:
1. `slug`
2. `title`
   - example: `Day 1 Morning Session`
3. `sessionDate`
4. `status`
   - `upcoming | live | completed`
5. `venue`
6. `summary`
7. `resultGroups`

### `liveCoverage.sessions.resultGroups`
Array of discipline result tables:
1. `discipline`
   - example: `Men's 100m`
2. `roundLabel`
   - example: `Final`, `Heat 2`, `Qualification`
3. `gender`
   - `men | women | mixed | open`
4. `classification`
   - optional
   - example: `Track`, `Jumps`, `Throws`, `Combined`
5. `unitLabel`
   - example: `Time`, `Distance`, `Points`
6. `isFinal`
   - checkbox
7. `isMedalDiscipline`
   - checkbox
8. `rows`

### `liveCoverage.sessions.resultGroups.rows`
Each table row:
1. `rank`
2. `laneOrOrder`
3. `athleteName`
4. `unitOrState`
5. `performance`
6. `wind`
7. `points`
8. `qualificationMark`
9. `note`
10. `isIndianHighlight`

This is deliberately not over-normalized.
For the MVP, editorial speed is more important than theoretical purity.

---

## 7) Admin Workflow

### Before event
1. create or update the Federation Cup `CalendarEvent`
2. upload hero image
3. enable `liveCoverage`
4. create session shells for all four days
5. add empty or draft discipline groups if known

### During event
1. editor updates `publicStatus`
2. editor updates `lastUpdatedAt`
3. editor fills result rows as official results arrive
4. editor adds short `liveNote` when needed

### After event
1. mark event `completed`
2. mark all sessions `completed`
3. final cleanup of rankings, notes, and highlights

---

## 8) Frontend Requirements

### Existing base to reuse
1. `calendar-detail.component.ts`
2. `calendar-detail.component.html`
3. `PayloadService.getCalendarEventBySlug`

### Frontend changes
1. extend the `CalendarEvent` type with `liveCoverage`
2. update the GraphQL query for event detail
3. add a `Live Results` rendering block in the event detail page
4. add status pill + last updated display
5. render session accordions or stacked panels
6. render discipline result tables

### Refresh behavior
For MVP:
1. use `network-only` fetch for event detail
2. add a visible `Refresh results` action
3. optional lightweight auto-refresh every 60 seconds while page is visible

This is enough for a controlled first test.

---

## 9) UX Rules

1. `Live Results` should only appear when `liveCoverage.enabled = true`.
2. If the event is not live-enabled, the page should behave exactly like today.
3. The results area must feel credible and calm, not flashy.
4. Tables should favor readability over visual experimentation.
5. The page should work well on mobile first.
6. A user should understand within one screen:
   - what event this is
   - whether it is live
   - what session is active
   - where the latest results are

---

## 10) MVP Data Rules

### Required for launch
1. event title
2. date range
3. venue/location
4. public status
5. last updated
6. at least one session
7. at least one result table

### Nice to have
1. hero image
2. highlights note
3. official source link
4. athlete linking later

### Not required for MVP
1. athlete IDs on every row
2. automatic qualification logic
3. federation sync
4. standings widgets
5. deep filtering

---

## 11) Risks

### Product risks
1. manual admin entry may be too slow if result tables are too granular
2. public trust drops if timestamps are stale or unclear

### Technical risks
1. over-designing a universal model too early
2. trying to reuse `Matches` for athletics
3. building too much before first live test

### Mitigation
1. keep the model athletics-first
2. keep the page on the existing event route
3. support manual publish first, automation later

---

## 12) Go / No-Go for MVP

The Federation Cup MVP is `GO` only if all are true:
1. event detail page renders structured result tables reliably
2. admin update flow is usable without developer intervention
3. mobile layout is clean
4. result updates appear publicly without cache confusion
5. editors can update the event in less than a few minutes per session block

---

## 13) Implementation Order for V3.1

1. Add `liveCoverage` to `CalendarEvents`.
2. Regenerate Payload types.
3. Extend `PayloadService` event detail query.
4. Build `Live Results` block on `calendar-detail`.
5. Create Federation Cup sample entry in admin.
6. Test on desktop + mobile with mock data.
7. Rehearse a real publishing flow before May 22, 2026.

---

## 14) Future Expansion After MVP

If the Federation Cup MVP works well, next layers can be:
1. reusable tournament result patterns by sport
2. team-sport hub model:
   - tournament
   - India window
   - fixtures
3. athlete-linked result rows
4. public auto-refresh
5. live medals/records/highlights

But none of these are required for the first test.

---

## 15) Decision Summary

For V3.1, the correct first live feature is:
- not a generic tournament platform
- not a match engine
- not a new route

It is:
- an athletics-first live results extension on top of the existing calendar event page
- tested on the `29th National Senior Athletics Federation Competition`
- manually operated from Payload admin

That gives IOD a believable, achievable first live coverage product without derailing V3.0.
