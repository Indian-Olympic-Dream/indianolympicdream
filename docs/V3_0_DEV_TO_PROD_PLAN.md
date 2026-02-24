# Indian Olympic Dream - V3.0 Dev to Prod Plan

## 1) Current State Snapshot (as of 2026-02-24)

### Codebase status
- Branch: `feature/subscription`
- Working tree: large in-progress diff across app shell, history, sports, athletes, payload service.
- New top-level Sports page exists (`/sports`) and route is wired.
- Athletes page has been rebuilt from legacy card flow to a filterable table flow.

### Implemented capabilities
- History home redesigned with:
  - era filter
  - sports and editions rails
  - medal-tier visual signaling
- Sports page includes:
  - tier grouping/filtering (gold/silver/bronze/heartbreak/participated/LA-program)
  - participation and athlete metrics
- History sport detail includes discipline-aware grouping/filtering logic.
- Athletes page now supports filters by:
  - sport
  - edition
  - active/inactive
- Athletes filters are query-param based and refresh-persistent:
  - `sport`
  - `edition`
  - `active`

### Build and stability signals
- `npm run build:clean` passes.
- Current warnings are style-budget warnings for:
  - `history.component.scss`
  - `history-sport-detail.component.scss`
  - `edition-detail.component.scss`

### Known risks/gaps
- Service worker is configured to cache `/api/**` with `performance` strategy and `maxAge: 1d`.
  - This can show stale data for active athletes and dynamic counters.
- GraphQL athlete list previously failed on partial errors; now hardened with `errorPolicy: 'all'`.
- Data quality inconsistency exists in athletes data (e.g., `gender` enum integrity issues).
- Large uncommitted change set increases regression risk.

---

## 2) V3.0 Scope Lock (Must Ship)

### In-scope (V3.0)
1. App shell navigation (desktop + mobile) with stable cross-page discoverability.
2. History home as primary entry (medal context, eras, sports rail, editions rail).
3. Sports home with tier-based discovery and consistent card system.
4. Sport detail with discipline filtering and correct back navigation behavior.
5. Athletes table flow with filters (`sport`, `edition`, `isActive`) + query param persistence.
6. Data correctness baseline for key public metrics (active athletes, participations, medals by tier).

### Out-of-scope (post V3.0)
1. Calendar launch as major nav surface.
2. Advanced animations/auto-rotating carousels.
3. Deep athlete profile redesign.
4. New LA 2028 feature set beyond current placeholder/program visibility.

---

## 3) Workstreams to Finish Before Release

### WS-A: Data Integrity and Mapping
- Validate and lock sport/sub-discipline mapping for:
  - Aquatics
  - Cycling
  - Gymnastics
  - Equestrian
  - Wrestling
- Verify active-athlete policy for current phase (Badminton-only active set).
- Add one reusable DB validation script/report for:
  - invalid enum values
  - orphan references
  - parent/child sport mapping mismatches

Exit criteria:
- All core dashboard counts match DB source-of-truth spot checks.
- No broken GraphQL list rendering due malformed fields.

### WS-B: UX Consistency and Interaction
- Finalize card language (sports vs editions) and lock tokens:
  - border/background rules
  - title color hierarchy
  - badge behavior
- Validate responsive layouts (320px, 390px, 768px, 1024px, 1440px).
- Ensure toolbar + bottom nav behavior remains consistent across nested routes.

Exit criteria:
- No layout jumps/overflow on target breakpoints.
- Navigation always offers forward path (not browser-back dependent).

### WS-C: Athletes V3 Table Hardening
- Keep query-param persistence as source-of-truth state.
- Confirm table filtering correctness across full dataset.
- Ensure default sorting, no-result messaging, and status-pill semantics are stable.

Exit criteria:
- Refresh keeps filter state.
- Filter combinations produce expected row counts.

### WS-D: Caching and Freshness Control
- Adjust service worker data caching for `/api/**`:
  - either remove API caching for V3.0, or
  - use freshness strategy with short TTL for dynamic data.
- Validate stale-data behavior on desktop/mobile PWA installs.

Exit criteria:
- Active athletes and recent DB updates reflect reliably without manual cache clearing.

### WS-E: Release Hygiene
- Split and commit by feature area (avoid one mega commit).
- Add release notes + QA checklist artifact.
- Smoke test production build in container/nginx path.

Exit criteria:
- Clean commit history for rollback.
- Reproducible prod build with known checksum/hash output.

---

## 4) Environment Flow (Dev -> QA -> Prod)

### Dev
- Local FE: `npm start` (proxy to payload backend)
- Local payload: verify same DB used for test scenarios.
- Daily checks:
  - `npm run build:clean`
  - route smoke check
  - data sanity snapshots (active athletes, sports count, editions count)

### QA/Staging
- Deploy FE build from release branch.
- Point to staging payload/DB clone.
- Execute regression matrix (below).
- Freeze content migrations during final QA window.

### Prod
- Create release tag: `v3.0.x`.
- Deploy backend/data adjustments first (if any), then FE.
- Post-deploy verification in first 30 min:
  - `/` history loads
  - `/sports` loads with tiers
  - `/sport/:slug` discipline filters
  - `/athletes` filter/query param behavior
  - active athlete count matches DB policy

Rollback plan:
- Keep previous FE artifact + previous payload snapshot.
- If critical mismatch, rollback FE first; rollback data only if required.

---

## 5) Regression Matrix (Minimum)

### Core routes
1. `/`
2. `/sports`
3. `/sport/hockey` (or any high-volume sport)
4. `/athletes`
5. One edition route (e.g. `/paris-2024` or `/:slug`)

### Critical scenarios
1. Era filter changes counts/cards consistently.
2. Sports cards tier visual rules remain consistent.
3. Editions cards style parity and readability on mobile.
4. Athletes filters combine correctly:
   - sport only
   - edition only
   - active only
   - all three combined
5. Refresh preserves athletes filter state via URL params.
6. Data freshness after admin DB changes (no stale `isActive` values).

---

## 6) Release Gates (Go / No-Go)

Release is `GO` only if all are true:
1. Production build passes.
2. No runtime blocking GraphQL errors on core pages.
3. Active-athlete policy reflected correctly in UI.
4. Filter persistence works on refresh/share URL.
5. Mobile UX is validated for history/sports/athletes.
6. Rollback artifact is prepared.

---

## 7) Suggested Execution Order (Pragmatic)

1. Stabilize data freshness/caching (`WS-D`) and data integrity (`WS-A`).
2. Lock UX and visual tokens (`WS-B`).
3. Final hardening of athletes flow (`WS-C`).
4. Run full regression + pre-release cut (`WS-E`).
5. Stage deploy -> Prod deploy with monitored rollout.

