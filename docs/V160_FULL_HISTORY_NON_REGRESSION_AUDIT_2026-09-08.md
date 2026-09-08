# LA PAUSE CLUB Android v1.6 — FULL HISTORY NON-REGRESSION AUDIT

Date: 2026-09-08
Branch: `android-v160-stabilization`
Status: ACTIVE BLOCKING CONTRACT

## 0. User override / absolute visual rule

The historical LA PAUSE CLUB v1.6 interface is the ONLY visual authority for the current product.

- Keep the exact v1.6 visual system.
- Do not import v230/v240/v250/v29x/v30x visual shells.
- Do not activate onboarding or SaaS surfaces.
- Do not redesign pages while restoring functionality.
- Functional/native/data improvements MUST be additive behind the historical interface.
- A later feature is not allowed to disappear merely because the visual shell was rolled back.
- CSS/visual-source hashes remain frozen unless the user explicitly requests a visual change.

This rule supersedes later canonical visual-template requirements while preserving their accepted FUNCTIONAL requirements.

## 1. Why the previous “FINAL” is invalidated

The previously signed v1.6 artifact cannot be considered fully stabilized because:

1. The app targets Android API 36 but the physical Native Smoke ran on API 33.
2. Android 16/API 36 no longer dispatches legacy `Activity.onBackPressed()` by default for target-36 apps, which made the real device Back behavior differ from CI.
3. The v1.6 enrichment contract still contained items marked `À développer` / `Audit requis` when the signed artifact was produced.
4. Important regression tests existed for Control Center, Device Control, Floor Builder and known bugs but were not part of the stabilization CI/release gate.
5. Several post-v1.6 engines were present only as data/calculation APIs, not proven as reachable end-to-end operator functionality in the classic UI.

Therefore “green CI” is no longer sufficient. Every critical requirement below needs a source-level gate plus an end-to-end/runtime gate when applicable.

## 2. Status legend

- `PASS`: present and directly proven in the classic v1.6 runtime.
- `PARTIAL`: engine/data support exists but UI/native/runtime path is incomplete or not fully proven.
- `BROKEN`: behavior is known to fail on a real target platform.
- `MISSING`: required functionality is not integrated in the classic v1.6 runtime.
- `PARKED`: deliberately excluded by current user instruction, not a regression.
- `UNPROVEN`: code may exist but current tests do not prove the real user path.

## 3. Navigation / lifecycle / Android platform

| Requirement | Current audit | Required proof |
|---|---|---|
| Android Back closes modal/sheet/drawer first | PARTIAL | physical + JS journey |
| Android Back returns one logical level | PARTIAL | API36 physical navigation matrix |
| Android Back never brutally exits | BROKEN in previous signed APK; FIX IN PROGRESS | API36 physical Back smoke |
| True root exit is deliberate/confirmed, never accidental | PARTIAL | root journey |
| Internal history, not forced Home | PARTIAL | multi-screen journey |
| Swipe-back uses same navigation contract | PARTIAL | physical gesture/journey |
| Portrait -> landscape keeps current screen | UNPROVEN | API36 rotation journey |
| Landscape -> portrait keeps current screen | UNPROVEN | API36 rotation journey |
| Preserve sub-screen/modal/form/selection/filter/scroll where relevant | UNPROVEN | persistence journey |
| Process/app relaunch recovers durable business state | PARTIAL | native recovery + real relaunch |
| APK update preserves customer/business data | PARTIAL | update migration smoke |

Immediate Android 16 compatibility fix started at commit `155283360cf161bf883ebaf5d9a5133e5a7d5bfb` without visual changes.

## 4. Historical v1.6 product must never regress

These historical areas remain mandatory and must continue to use the existing interface:

- Gaming Floor / Salle.
- Sessions.
- Clients / CRM.
- Snacks / drinks / products.
- Caisse.
- Reservations.
- Queue / waitlist.
- Pass / abonnements.
- History.
- Tournaments.
- Challenges.
- King / Hall / leaderboard where already present.
- Equipment / maintenance / incidents / inventory / purchases where already present.
- Settings.
- Import/export/backup behaviors.
- Native session alerts.
- Persistent local state.
- Offline operation.

No enrichment may replace a working historical renderer merely to reuse a newer shell.

## 5. Sessions — cumulative requirements

| Requirement | Current audit |
|---|---|
| Time session | PASS/PARTIAL runtime gates exist |
| Budget session | PASS/PARTIAL runtime gates exist |
| Fixed session | PASS/PARTIAL runtime gates exist |
| Open/free session if policy allows | PARTIAL |
| Default payment timing = advance | PASS/PARTIAL; must retest full journey |
| Payment timing coherent with session type | UNPROVEN end-to-end |
| Shift-required detour must preserve complete draft | PASS source/runtime gate exists |
| Duplicate open shift recovery without deleting history | PASS source/runtime gate exists |
| Session pause/resume | UNPROVEN in current exhaustive gate |
| Session stop/finalize | PARTIAL |
| Extension | PASS engine; UI journey must be proven |
| Reload in middle of active session | PARTIAL |
| Session + payment + history use the same price truth | PARTIAL |
| No double charge | PARTIAL |
| No hidden image-URL field in session journey | UNPROVEN classic UI |

## 6. PS5 / Console operator journey

Required cumulative contract:

- Solo and Duo.
- Time / budget / fixed / open according to policy.
- Default payment in advance.
- PS5 Duo 30 minutes in maximum 3 operator actions.
- `+30 min`, `+1 h`, `+2 h` where configured.
- Snack/add-on from active context.
- Correct amount before payment and same amount after payment/history.
- No old operator dependency on `#payNow`, `data-duration`, `data-players` selectors.
- Historical dynamic game/console media preserved.

Current audit: `PARTIAL`. Engines and session adapters exist; the complete classic-v1.6 physical click-budget journey is not yet proven.

## 7. Multi-activity / universal resource model

Required resource families preserved from accepted history:

1. CONSOLE / PS5
2. PC_GAMING
3. SIM_RACING
4. BILLIARD_TABLE
5. SNOOKER_TABLE
6. TABLE_TENNIS
7. PRIVATE_ROOM
8. CUSTOM

Accepted pricing semantics:

- `TIME_PRORATED`
- `TIME_BLOCK`
- `FIXED_SESSION`
- `PER_GAME`
- `PER_PLAYER_GAME`
- `CUSTOM_AMOUNT` where explicitly allowed

Current audit:

- Billing adapter and contextual profiles exist: `PARTIAL/PASS engine`.
- Full classic-v1.6 UI accessibility for all resource types: `UNPROVEN/PARTIAL`.
- No resource may silently fall back to hourly pricing when configured per game/block.

## 8. Billard / Snooker

Mandatory behavior:

- Separate operator logic from console sessions.
- Default commercial model per game unless configured otherwise.
- 1 / 3 / 5 games where configured.
- Purchased / played / remaining game count.
- Correct per-game price and total.
- `+1 partie` as immediate action.
- No negative/fake time countdown for per-game sessions.
- Snooker price edit -> save -> persistence -> reload -> quote/session must keep the new price.

Current audit: billing engine proves PER_GAME quotes and Control Center exposes an ADD_GAME intent, but the complete classic UI journey is `PARTIAL/UNPROVEN`.

## 9. SIM Racing

Mandatory behavior:

- Correct SIM rate (historical target 45 MAD/h unless settings change it).
- Fast 15/30/60-minute or configured block flow.
- 30-minute SIM journey optimized to <=3 actions where preset exists.
- No irrelevant console-only fields.
- Correct dynamic SIM/racing media.

Current audit: engine parity for 45 MAD/h is proven; physical classic UI click budget remains `UNPROVEN`.

## 10. Client capture / CRM

Mandatory behavior:

- Anonymous customer is truly anonymous (`Non identifié`), never a fake selected customer.
- Search existing by name/phone.
- Fast inline create.
- Duplicate-phone guard.
- Reuse selected customer in session.
- Customer data persists through reload/update.
- Guest -> identified/member conversion without losing history.
- CRM history: sessions, purchases, spend, visits where available.
- Future loyalty/marketing data must not slow the operator journey.

Current audit: fast search/create/duplicate guard engines exist; historical CRM exists; complete inline journey and update migration are `PARTIAL`.

## 11. Products / snacks / stock

Mandatory behavior:

- Real product catalog with images.
- User catalog never overwritten by a default seed.
- Sale decrements stock exactly once.
- Low-stock alert.
- Session-linked snack is visible immediately on active resource/cockpit.
- Item names, quantities, totals and payment state survive reload.
- Quick snack sale without unnecessary navigation.
- Stock persists after APK update.

Current audit: catalog non-overwrite engine and historical products exist; session-linked snack cockpit persistence is `UNPROVEN/PARTIAL`.

## 12. Caisse / finance

Mandatory behavior:

- Open shift / float.
- Payment methods.
- Expected cash vs counted cash.
- Movements and expenses separated from revenue.
- Close/reconcile.
- Refund exactly once.
- Partial refund.
- Credit note where supported.
- Receipt generation.
- No double debit.
- Posted gross minus refund ledger reconstructs truth.

Current audit: accounting, cash DOM, prepaid sales, booking refund and finance engines have tests. Full physical A-to-Z operator journey is `PARTIAL`.

## 13. Reservations / queue

Mandatory behavior:

- Reservation persistence.
- Check-in / start session handoff.
- No-show/reschedule logic where present.
- Unpaid reservation must not block forever.
- Waitlist persistence.
- Fast assignment to compatible free resource.
- Queue state reflected in operator actions.

Current audit: classic modules exist and booking-refund gate exists; full rush journey is `UNPROVEN/PARTIAL`.

## 14. Tournaments / challenges / community

Mandatory behavior:

- Tournament create -> registration -> qualification -> progression -> final -> winner/podium.
- No progression dead-end before final.
- Challenges progress correctly.
- King / Hall / leaderboard where already developed.
- Elo / match suggestion / missions when exposed.
- Rewards update the real customer state exactly once.

Current audit: historical tournament/challenge surfaces exist; enrichment engine proves Elo/matchmaker/missions; end-to-end tournament completion in current signed-style build is `UNPROVEN`.

## 15. Dynamic media

Mandatory behavior:

- Preserve historical media logic, never replace it with generic modern-shell hero images.
- Idle PS5 -> historical available image unless valid override.
- Idle SIM -> historical SIM image unless valid override.
- Active game -> football/racing/combat/tactical/esport/sim media as appropriate.
- Product images remain real/local.
- Responsive crop; no broken/distorted media after rotation.
- Offline fallback.
- New activities need proper configured media without changing the classic visual system.

Current audit: PS5/SIM/game/product assets are packaged; complete 8-type media coverage and physical rotation/offline proof are `PARTIAL`.

## 16. Control Center / Next Best Action / assisted revenue

Accepted functional requirements, adapted behind classic v1.6 UI:

- Operator-first actions, not decorative analytics.
- Maximum useful priority actions, with urgent items first.
- Session ending soon.
- Device risk.
- `+30 min` opportunity.
- Billard/Snooker `+1 partie` opportunity.
- Snack opportunity only when stock > 0.
- Explicit operator acceptance required.
- Return to classic operator context after action.
- `acceptedActions` changes only on actual accepted actions.
- `assistedRevenue` changes only when attributable revenue is actually realized.
- No fake KPI.

Current audit: calculation engine is strong and has a dedicated test, but the test explicitly proves it does NOT replace the historical renderer. Therefore actual classic-UI Control Center reachability is `PARTIAL` and must be integrated/tested without redesign.

## 17. Floor Builder / configurable room

Mandatory functional requirements:

- Zones.
- Resource placement.
- Move/resize.
- Walls/geometry where supported.
- Resource identity remains the historical station authority.
- Validation prevents missing/unknown stations.
- Explicit commit only.
- Snapshot / rollback.
- No automatic destructive persistence.
- UI must live inside classic Salle/Paramètres design.

Current audit: engine and tests exist, but UI reachability is `MISSING/PARTIAL`. The current test explicitly proves the historical renderer is not replaced.

## 18. Device Control / TV / stations

Mandatory accepted requirements:

- Registry and association.
- Discovery only when real native scanner exists.
- LAN/local endpoints only.
- No fake success.
- Capability honesty.
- Pairing explicit.
- Secure pairing must fail closed if secure storage is unavailable.
- Heartbeat / ONLINE-OFFLINE truth.
- Dynamic IP handling.
- ARP/MAC/scanner foundation where native capability exists.
- Command idempotency.
- Overlay/message only when supported by the paired agent.
- Session-device association.
- Heartbeat target 30s where configured.
- Local/offline operation.

Current audit: JS protocol/registry/queue engine exists, but its own test proves discovery is unavailable, secure native pairing is blocked and transport is disabled. Therefore real Device Control is `MISSING/PARTIAL`, not complete.

## 19. Android notifications

Mandatory:

- Native notification permission.
- Background/minimized app.
- Screen off where Android permits.
- warning before session end.
- session end.
- critical overtime.
- survive process lifecycle/reboot where scheduled state requires it.
- cancel correctly when session ends/changes.

Current audit: AlarmManager + BootReceiver + SessionAlarmReceiver paths exist. Full real-device lifecycle suite is `PARTIAL/UNPROVEN`.

## 20. Offline / persistence / Core

Mandatory:

- App can run standalone with no PC/cloud/internet.
- Sessions/cash/clients/products continue locally.
- Durable local state.
- Primary + backup recovery.
- CoreStore recovery layer.
- No data loss on update.
- No fake synchronized/online state.

Current audit: local SharedPreferences + CoreStore recovery exist and several recovery gates pass. Cross-version APK update, full rush state and every domain remain `PARTIAL` until physical migration tests pass.

## 21. Sync / Web parity / security — current decision

The accepted architecture remains useful, but the current user explicitly requested classic v1.6 with no active SaaS/onboarding.

- SaaS onboarding: `PARKED`.
- v250/v29x/v30x shells: `PARKED/FORBIDDEN visually`.
- Tenant/workspace/subscription/entitlement SaaS UI: `PARKED`.
- Web/Android sync foundation: `PARTIAL`, may be integrated only when it does not activate SaaS UI or break standalone mode.
- Native device/security adapters required by already accepted local functions are NOT considered SaaS and must be restored selectively.

## 22. Trust / audit / support

Mandatory accepted behavior:

- Existing audit events keep working.
- Additive trust chain may mirror them, never replace/delete history.
- Suspicious event lifecycle is explicit.
- Support bundle redacts secrets/PII.
- No secret/token/PIN hash in diagnostics.
- No silent data deletion.

Current audit: trust-chain and redaction engines have tests; broader physical diagnostics remain `PARTIAL`.

## 23. Internationalization / RTL

- Android `supportsRtl` remains enabled.
- Locale preferences may be stored.
- Full FR/AR/EN product translation is not proven in current classic runtime.
- No redesign is authorized to satisfy i18n.

Status: `PARTIAL`.

## 24. QA contract — now mandatory before any signed FINAL

### Static/product gates
- Exact historical CSS/visual JS hashes.
- No v250 visual runtime.
- No onboarding/SaaS runtime.
- No duplicate scripts.
- No missing local assets.
- No `location.reload()` in additive stabilization/enrichment.

### Functional Node gates
Must include, at minimum:
- frozen design
- known bugs
- navigation
- native Back contract
- routes
- interactions
- tabs
- settings persistence
- fresh catalog bootstrap
- shift/session recovery
- cash DOM
- accounting
- prepaid sales
- booking refund
- raw CDP socket
- native runtime recovery
- enrichment foundation
- Core recovery
- session form
- session start
- session form UI
- session stack health
- Control Center
- Device Control
- Floor Builder

### Android physical gates
- API 33 compatibility.
- API 36 target-platform compatibility.
- Home Back no accidental exit.
- Secondary screen Back.
- Modal/sheet/drawer Back priority.
- Multiple-level history.
- Rotation portrait/landscape.
- active session through rotation/relaunch.
- process death/recovery.
- notification lifecycle.
- upgrade install preserving data.
- no fatal logcat.

### Operator journey gates
A continuous realistic journey, not isolated clicks:
- open shift
- 3 walk-in rush
- PS5 solo
- PS5 Duo 30 min <=3 actions
- SIM 30 min <=3 actions
- Billard per game
- +1 game
- PC budget
- reservation -> arrival -> session
- queue -> assignment
- extension
- pause/resume
- snack on active session
- payment
- refund
- session finish/history
- close/reconcile shift
- reload/rotation mid-rush

### Click matrix
Every visible interactive target in the classic v1.6 interface must be classified and tested:
- bottom tabs
- drawer/menu destinations
- buttons
- cards
- modal actions
- sheet actions
- forms
- selects
- toggles
- save/cancel/delete/confirm
- back/swipe
- imported/exported data actions
- settings actions

No click may be accepted as “working” merely because the app did not crash; the destination/state change must be semantically correct.

## 25. Release rule

A signed APK is NOT `FINAL` until:

1. Full historical matrix is green.
2. API36 native regression is green.
3. Continuous operator journey is green.
4. Classic v1.6 visual hashes are unchanged.
5. No function classified MISSING/BROKEN remains in the agreed current scope.
6. Any intentionally excluded feature is explicitly `PARKED`, never silently lost.
7. The exact same source SHA that passed all required gates is the source that gets permanently signed.

## 26. Current priority queue discovered by this audit

P0 — release blockers:
1. Android 16 Back dispatch.
2. API36 physical navigation/lifecycle gate.
3. Run ALL existing v1.6 tests in CI, including previously omitted Control Center/Device/Floor/known-bugs gates.
4. Real continuous operator journey on classic UI.
5. Rotation/state restoration proof.
6. Data-preserving APK upgrade proof.

P1 — functional restoration behind classic UI:
1. Make Control Center actions reachable without redesign.
2. Complete all-resource session journeys in classic UI.
3. Complete Billard/Snooker per-game cockpit semantics.
4. Prove PS5 Duo 30 and SIM 30 click budgets.
5. Session-linked snack visibility/persistence.
6. Floor Builder integration under classic settings.
7. Real native Device Control adapter/transport where supported.
8. Complete notification lifecycle proof.

P2 — later selective platform work:
- sync foundation
- deeper security adapters
- owner/analytics enhancements
- i18n expansion

PARKED until explicit user reactivation:
- SaaS onboarding
- SaaS visual surfaces
- v250/v29x/v30x visual shells
- subscription/entitlement UI
- franchise/HQ/white-label UI

---

This file is cumulative. A future change may improve a requirement, but must not silently delete or downgrade any item above.
