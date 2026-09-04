# LA PAUSE OS 2.4 — Operator UX cumulative checkpoint

This file is the canonical cumulative UX checkpoint for `android-device-control-v240`.

## Rule
Every new operator/client UX request is cumulative. A new request MUST NOT replace, cancel, or weaken an earlier accepted requirement unless explicitly requested by the user.

## Protected foundations
- Keep the validated LA PAUSE OS 2.3 billing/session engine.
- Keep Device Control 2.4 and TV Agent work intact.
- Do not rebuild a new manager app or reset the project.
- Offline-first and persisted state remain mandatory.

## Active cumulative requirements

### 1. Operator speed / fluidity
- Optimize every screen for minimum operator actions and minimum scroll.
- Prioritize the most frequent, urgent, and revenue-impacting action.
- No decorative block may push useful actions below the fold without a business reason.
- Mobile portrait must remain fully usable with the bottom dock never hiding actionable content.

### 2. Metier-first organization
- Never mix all resource types into one operational floor by default.
- Organize operations by métier/activity: Console/PS5, Sim Racing, PC Gaming, Billiard, Snooker, Table Tennis, Private Room, Arcade, Custom.
- The selected métier shows only its own resources, KPIs, pricing semantics and actions.
- A global overview may exist separately, but it must not replace métier-focused operations.
- Each métier must have a purpose-built session journey and active-session cockpit.

### 3. Dynamic media restoration
- Preserve the proven historical dynamic-media behavior.
- Idle Console/PS5 uses `media/ps5-available.png` unless explicitly overridden with a valid specific resource image.
- Idle SIM uses `media/sim-vip.png` unless explicitly overridden.
- Active game-oriented resources dynamically use the chosen game universe media: football, racing, combat, tactical/FPS, esport, sim.
- Do not force `media/premium/ps5.jpg` or `media/premium/sim.jpg` over the historical dynamic-media logic.
- Non-game métier flows such as billiard/snooker must not waste session-start space on a large hero image.

### 4. Client capture / marketing
- Never present `Client passage` as a selected fake customer.
- Anonymous sessions display `Non identifié`.
- Identification is optional and fast: search by name/phone, select existing, or create a client inline.
- Client capture must support future loyalty/history/marketing without slowing the operator.
- Marketing surfaces must be actionable, not dead counters.

### 5. Dashboard redesign
- Replace reporting-heavy, zero-filled dashboard behavior with an operator command center.
- Selected métier and its available/active resources must be visible quickly.
- Remove duplicated branding/title space and dead KPI blocks.
- Surface actionable sales/conversion opportunities and urgent operational actions.
- Every metric shown must support an operator decision or action.

### 6. Pricing correctness
- Snooker price saving is a blocking bug until proven through edit -> save -> persistence -> reload -> quote/session use.
- Saving a type-level métier price must clear stale conflicting resource-level overrides when appropriate.
- Billiard/Snooker default commercial model remains per-game unless explicitly configured otherwise.
- No resource may silently fall back to a wrong hourly model.

### 7. Active-session cockpit
- Per-game sessions (Billiard/Snooker etc.) must never render a time countdown derived from a null/invalid `endAt`.
- Per-game active status must show units/parties and amount, not a fake or negative timer.
- Active-session UI must be métier-specific rather than one generic sheet for all resource types.
- The first visible actions must match the métier: e.g. `+1 partie` for Billiard/Snooker, time extension for timed resources, etc.

### 8. Snacks on the active resource
- Snacks/drinks ordered for a session must be visible on the active resource/cockpit immediately.
- Show item names, quantities, snack total and payment state when relevant.
- Snack order visibility must survive reload and remain linked to the correct session/resource.
- Quick snack selling must remain reachable without leaving the operator context unnecessarily.

### 9. Whole-app visual system
- Do not apply random cosmetic patches screen by screen.
- Build a clean, coherent template system for every major page/screen.
- Each template must be designed around business outcome, operator speed, information hierarchy and mobile ergonomics.
- Shared design tokens/components are allowed, but every page must have a purpose-built information architecture.

### 10. QA gates
- Preserve existing 2.3 and Device Control gates.
- Add regression gates for métier separation, dynamic media, no fake walk-in select, Snooker persistence, per-game timer semantics, snack visibility, active-cockpit semantics and mobile action visibility.
- Do not call the UX redesign complete until a full A-to-Z click test has been rerun.

## Current implementation checkpoint
At the time this checkpoint was added, the branch already contained cumulative UX restoration files and tests, including `client-operator-ux-v240.js`, `client-operator-ux-v240.css`, `client-operator-ux-v240-hotfix.js`, and `client-v240-operator-ux.spec.js`.

The next priority is to continue from the latest branch HEAD, not from an older commit, with focus on:
1. Per-game timer bug shown in BILLIARD-02.
2. Snack visibility on active resources.
3. Purpose-built active-session cockpit per métier.
4. Snooker pricing real persistence verification.
5. Broader screen-by-screen template redesign and full QA.
