# LA PAUSE OS — Global Product Diagnostic v301

Date: 2026-09-05
Branch: `android-new-app-v250`

## Executive diagnosis

The current application is not failing because of one isolated UI bug. The main architectural conflict is that authentication, setup/onboarding and the operational application have historically been implemented as screen numbers inside one shared runtime/state graph. Multiple later layers override renderers and add global click/touch handlers, while navigation frequently persists a screen then reloads the WebView. That combination explains intermittent jumps between onboarding and operational Home, inert-looking controls, scroll regressions and contradictions between setup data and operational surfaces.

v301 introduces a lifecycle boundary without replacing the operational engine: signed-out users are restricted to public/auth screens; signed-in users with incomplete setup are restricted to the four setup screens; operational screens are inaccessible until explicit trial activation.

## P0 — addressed in v301

1. **SaaS lifecycle isolation**
   - New persisted `lifecycle.setupComplete` boundary.
   - Signed-out user cannot reach operational screens.
   - Signed-in but unconfigured tenant is held inside setup screens 4 / 9 / 10 / 8.
   - Fully configured tenant remains on activation review until explicit Trial activation.
   - Trial starts only after activation and receives an explicit expiry.

2. **Onboarding reduced to four meaningful steps**
   - Establishment: organization + venue/branch essentials in one screen.
   - Activities / prices / sales configuration.
   - Floor configuration.
   - Review + Trial activation.
   - Old post-go-live checks such as test sale, test session and backup verification are no longer onboarding blockers.

3. **Global vertical scrolling / phone keyboard**
   - Non-landing pages recover document-level vertical scroll.
   - v301 fields use 16 px minimum input typography to avoid mobile zoom behavior.
   - Focused fields scroll into the visible center after keyboard opening.
   - v301 modals have their own vertical scroll region.

4. **Products integrated in principal setup**
   - Minimum setup catalog contains 24 real product names: 13 drinks and 11 snacks.
   - Products are persisted in `state.products`, not rendered only as Home decoration.
   - Setup lets operator enable/disable products and edit price + stock.
   - Initial stock is 0 so the system does not fabricate inventory.

5. **Activities and equipment**
   - Console / PS5, PC Gaming, SIM Racing, Billiard/Snooker and Arcade are available.
   - `ARCADE_MACHINE` is mapped as a real runtime resource type.
   - Counts and rates are data-driven and create/update managed resources.
   - PC and Arcade timed billing now use their own configured rate rather than falling back to PS5 pricing.

6. **Packages**
   - Setup toggle is no longer a decorative boolean only.
   - Enabling packages creates persisted 5-hour and 10-hour package definitions for configured hourly activities using operator-defined discounts.
   - Full client wallet purchase/redemption and automatic session consumption remain a separate P1 journey and must not be represented as completed yet.

7. **Floor builder**
   - Zones can be dragged with pointer/touch input.
   - Zone geometry is stored as percentage-based responsive coordinates.
   - Walls/separations can be drawn by selecting start/end points and are persisted in `floorLayout.walls`.
   - Undo wall is available.
   - Add Zone and Add Equipment remain functional and Arcades are included.

## Confirmed systemic issues still present outside the v301 setup path

### P1 — functional integrity

1. **Legacy tabs are structurally decorative**
   - The shared `tabs()` factory in `screens.js` renders plain `<button class="tab">` elements with no action identifier.
   - Many older screens therefore show tabs that cannot change content.
   - This requires replacing each affected module with stateful tab content, not merely adding a click animation.

2. **Multiple renderer generations coexist**
   - Screens 1–10 exist in legacy files, v290/v291, and now v301 overrides.
   - Screen 42 also has multiple historical renderers before the current Home override.
   - Load order currently determines the winner. This is regression-prone and should be consolidated after the lifecycle repair is validated.

3. **Multiple global interaction engines coexist**
   - canonical-app, v291, v298, v299, v300 and v301 each own parts of click/touch/navigation behavior.
   - v300 solved the physical form tap path, but the long-term fix is a single navigation/action dispatcher.

4. **Reload-driven navigation**
   - Several layers call `location.reload()` after screen changes.
   - This increases keyboard/focus loss, visual flashing and race-condition risk.
   - Replace with one stateful router after onboarding stabilization.

5. **Operational package lifecycle incomplete**
   - Package definitions now exist and calculate correctly.
   - Purchase, assignment to a client, remaining-time ledger and redemption during a session still need an end-to-end implementation and test.

6. **Home merchandising is still a fixed presentation subset**
   - Current Home explicitly looks for Coca-Cola, Water, Red Bull and Snickers slots.
   - v301 fixes the source-of-truth mismatch by configuring a real catalog, but Home should later render its merchandising from enabled/in-stock configured products instead of four hardcoded product families.

### P1 — misleading/static module content found in legacy renderers

These modules contain example or static claims that must be made dynamic or clearly marked as demo/empty before product freeze:

- Membership screen: hardcoded Bronze / Silver / Gold / Platinum plans.
- Bookings calendar: hardcoded sample bookings such as `John D.` and `Team Alpha`.
- Incident screen: example incidents when no incident exists.
- HQ screen: static `System ONLINE` claim.
- Subscription screen: hardcoded Starter / Growth / Enterprise commercial cards.
- Settings screen: static status labels such as Enabled / Native / Ready.
- Security screen: static VALID / ENFORCED claims that are not all computed from runtime authority.
- Several legacy screens still use emoji as operational icons.

### P2 — architecture cleanup after functional QA

- Move bootstrap defaults out of the commercial runtime so a fresh SaaS tenant never has latent demo entities that later need migration/cleanup.
- Consolidate duplicate screen registrations and delete superseded renderers after user validation.
- Replace reload navigation with a single router and central back-stack.
- Create a module-by-module physical interaction matrix for every visible button, field, tab and modal.
- Add screenshot/viewport regression for Samsung A07-sized portrait and keyboard-open states.
- Add end-to-end data consistency checks: setup -> Home -> POS -> inventory -> finance -> analytics.

## Release rule from v301 onward

A visible control is not considered functional because it has markup or a handler token. Critical journeys must prove a real state transition. SaaS setup must prove that operational access is impossible before activation. Any static placeholder must be explicitly labeled as such rather than presenting success or live data.
