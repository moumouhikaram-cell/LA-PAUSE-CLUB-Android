# LA PAUSE OS 2.5 — Whole-app SaaS product audit

## Product decision
LA PAUSE OS is not a PS5 manager. It is an offline-first SaaS operating system for multi-activity leisure venues.

The existing domain/core is preserved. The entire visible product shell, navigation, information architecture and page templates are redesigned from scratch.

No new UI request replaces an earlier accepted requirement. Requirements are cumulative.

## Core to preserve
- P1 universal resources, rate plans, sessions and billing.
- P2 Device Mesh / Device Control and TV Agent work.
- P3 owner/trust/profit/audit/forecast/recommendation engines.
- P4 CRM/player growth, loyalty, missions, churn, referrals, demand and service requests.
- P5 SaaS tenant/venue/cloud/sync/entitlement/automation architecture.
- Offline-first persistence, outbox, Android bridge, notifications, secure store and signed build pipeline.

## Root causes in the current UI
1. **Multiple historical UI generations render into the same application.** `app.js`, v13/v14/v15/v17, P1-P5, client-product, operator-v230 and operator-ux-v240 all own pieces of UI. This causes visual inconsistency and renderer races.
2. **Legacy first render occurs before the modern client shell is ready.** This creates a visible old-dashboard flash at startup.
3. **Global shared components are still PS/hour-centric.** Examples include `Consoles & stations`, `/h`, `+15 min`, `joueurs`, and PS-specific setup defaults in generic components.
4. **The quick setup wizard is commercially wrong for a universal product.** It asks for `Tarifs horaires` for every activity and historically creates hourly plans for non-hourly métiers.
5. **Settings are a compatibility layer over several old settings systems.** Labels and station creation still contain PS5-era assumptions and duplicated field contracts.
6. **The operational floor mixes métiers.** Resource types with fundamentally different workflows are shown as one generic station grid.
7. **Active-session rendering is generic.** Timed and per-game sessions share the same timer/update path, causing the observed huge negative Billiard timer.
8. **Snacks are a secondary module instead of part of the live ticket.** Orders linked to a session are not surfaced strongly enough on the active resource.
9. **CRM/marketing intelligence exists in code but is not the product navigation.** Churn, missions, loyalty, referrals, player DNA, campaigns and next-best-actions are buried in technical P4/P5 pages.
10. **Owner intelligence is engineering-facing.** `P3`, `Venue Health`, `Lost Revenue`, `Audit Chain` etc. need product language and decision-first templates.
11. **Device Control is technically strong but visually isolated.** Devices must appear in resource context and System/Infrastructure, not as an unrelated technical island.
12. **Navigation is feature-list driven rather than job-to-be-done driven.** The old menu has too many categories and duplicate concepts.
13. **The app exposes internal implementation terms.** Phase names, protocol terms, legacy version language and engine concepts should not leak into normal operator UX.
14. **Empty/zero KPI grids dominate mobile space.** The dashboard reports instead of helping the next action.
15. **The product has no single design system.** Each generation introduced its own cards, buttons, sheets, modals, typography and spacing.

## New SaaS information architecture

### A. Today / Command
Purpose: what should I do now?
- Revenue today and cash status only when actionable.
- Urgent sessions / overdue / ending soon.
- Activity capacity by métier.
- Queue / arrivals / reservations.
- Sales and CRM opportunities.
- Device or operational blockers.
- One-tap global actions.

### B. Operations
Purpose: run each métier correctly.
- Console
- Sim Racing
- PC Gaming
- Billiard
- Snooker
- Table Tennis
- Private Rooms
- Arcade
- Custom activities

Each métier has its own:
- overview
- resource cards
- start-session template
- active-session cockpit
- pricing semantics
- quick actions
- status vocabulary

No mixed floor by default. A global capacity view is optional and separate.

### C. Sales
Purpose: convert activity into money.
- Live tickets / active baskets
- Snacks & drinks
- Quick sale
- Cash / shifts / payments
- Offers / bundles / passes
- Stock & purchasing

Session + snack + discount + payment are represented as one commercial ticket where appropriate.

### D. Customers
Purpose: identify, retain and reactivate customers.
- CRM directory
- Customer profile
- Visit/spend history
- Loyalty / points / passes
- Segments
- Churn / reactivation
- Missions / referrals
- Campaigns
- Game/activity demand

`Client passage` is never a fake customer. Anonymous = `Non identifié`.

### E. Planning & Community
Purpose: manage future demand and events.
- Reservations
- Queue
- Tournaments / challenges / leaderboards
- Community / matchups
- Service requests

### F. Insights
Purpose: owner decisions, not engineering telemetry.
- Business overview
- Revenue / margin
- Occupancy / utilization
- Customer retention
- Product/snack performance
- Lost-revenue opportunities
- Forecast
- Alerts / anomalies
- Daily brief

Technical audit remains available under System for authorized roles.

### G. System
Purpose: configure the SaaS and infrastructure.
- Venue / branches
- Activities & resources
- Pricing catalog
- Devices & automations
- Team / roles / permissions
- Notifications
- Appearance
- Security
- Cloud & sync
- Data / backup
- Subscription / entitlement
- About / diagnostics

## New navigation model
Mobile primary navigation is limited to four jobs plus a launcher:
1. Today
2. Operations
3. Sales
4. Customers
5. Launcher

The Launcher exposes Planning, Insights and System, with search. Tablet uses the same IA in a side rail.

The old `Accueil / Salle / Sessions / Caisse / Plus` shell is retired.

## Design system rules
- One shell, one component system, one spacing scale, one icon language.
- No historical `.page-head`, `.row-card`, `.settings-tile`, `.v17-panel`, etc. visible in the final product.
- New components use `lp-*` namespace.
- Every screen has a job statement and a single primary action.
- Information hierarchy: urgent/actionable > money/customer > context > diagnostics.
- Mobile first, thumb reachable, bottom navigation never masks content.
- No duplicated brand/title blocks.
- No giant decorative image unless it materially helps the decision.
- Dynamic media remains for activity/game recognition where useful.
- Non-game flows do not inherit game imagery or timers.
- Empty states teach the next action instead of showing dead KPI grids.

## Template families
1. `lp-command` — Today command center.
2. `lp-activity` — métier workspace.
3. `lp-resource` — resource card/list item.
4. `lp-session-start` — métier-specific start flow.
5. `lp-session-live` — métier-specific live cockpit.
6. `lp-ticket` — session + products + payments.
7. `lp-crm` — customer directory/profile/segments.
8. `lp-sales` — cash/orders/catalog/stock.
9. `lp-planning` — reservations/queue/events.
10. `lp-insights` — owner decision surfaces.
11. `lp-system` — settings/configuration/infrastructure.
12. `lp-dialog` / `lp-sheet` — unified modal/sheet primitives.

## Critical correctness bugs carried into redesign
- Billiard/Snooker per-game sessions must never be updated by the timed-session countdown path.
- Snooker pricing must pass edit -> save -> persist -> reload -> quote -> session billing.
- Session-linked snacks must appear immediately on the active ticket/resource with item, quantity, total and payment state.
- Dynamic game/activity media must survive start and reload.
- Anonymous clients must remain null/anonymous, not a stored fake `Client passage` identity.
- Device Control credentials remain SecureStore-only.

## Boot contract
- The legacy view is hidden before the first script executes.
- Startup displays only a branded LA PAUSE OS boot surface.
- The new SaaS shell becomes visible only after its router, chrome and first route are ready.
- On shell failure, display a new-style recovery screen; never reveal legacy UI as fallback.

## Migration strategy
The redesign is a UI/product migration on top of the existing core, not a new application.

1. Freeze and protect v2.4 Device Control baseline.
2. Introduce no-flash boot and the new `lp-*` shell.
3. Replace navigation and Today.
4. Replace Operations per métier, including start/live session templates.
5. Replace Sales and live ticket/snacks/cash.
6. Replace Customers/marketing.
7. Replace Planning/community.
8. Replace Insights/owner.
9. Replace System/settings/devices/cloud.
10. Remove all remaining legacy visual fallbacks.
11. Full A-to-Z product/client click audit.
12. Android native smoke + signed build.

## Definition of done
- No old dashboard flashes at boot.
- No old visual component is reachable through normal navigation.
- No PS-only wording exists in universal screens.
- Every métier has a correct workflow.
- Every route uses the new SaaS shell/templates.
- Existing core tests remain green and new SaaS UX gates pass.
- Final Android signed APK is tested with the new shell.
