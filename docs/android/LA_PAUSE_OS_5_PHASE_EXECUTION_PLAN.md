# LA PAUSE OS Android — 5 PHASE EXECUTION PLAN

Canonical source: `CODEX_LA_PAUSE_OS_MASTER_EXECUTION_PLAN_V2_AUDITED.md` (3,420 lines minimum) + current Android/Web verified capabilities.

This document compresses the implementation roadmap into **five execution phases maximum**. It does not shrink product scope. Every capability from the canonical CDC remains required and must map to one of these five phases.

## PHASE 1 — VENUE OS CORE
Goal: the Android tablet can operate a complete venue alone, offline, without PC/Internet/Cloud.

Scope:
- Venue/branch/settings/business time engine
- Universal Resource Engine: CONSOLE, SIM_RACING, PC_GAMING, BILLIARD_TABLE, SNOOKER_TABLE, TABLE_TENNIS, PRIVATE_ROOM, CUSTOM
- Resource capabilities/readiness/floor builder
- Universal RatePlan and pricing by resource/player/time/package
- Sessions: duration, budget, open, package/pass; pause/resume/extend/move/end/free
- Upfront payment invariant and due management
- Shift open/close, opening float, cash/card/other, cash in/out, expenses, corrections
- Payments/refunds groundwork, unique receipts, transaction/idempotency foundations
- Guest/customer/member, search/create/history
- Products/snacks/orders, stock movements, costs/margins
- Reservations, queue/waitlist, check-in/no-show, groups
- Pass, Pause Points, loyalty/membership foundations
- Existing tournament/challenge/King preserved and normalized progressively
- Equipment/maintenance/incidents preserved
- SQLite authoritative migration domain by domain
- Local event ledger, outbox, backup/recovery, offline/degraded operation
- AUTONOME mode fully operational

Checkpoint APK requirement: this phase must feel like a real Venue Operating System, not an architecture demo.

## PHASE 2 — DEVICE MESH & RELIABILITY
Goal: control and observe the physical venue safely.

Scope:
- Device registry + secure pairing + capabilities
- TV/agent identity, heartbeat, health, HDMI, latency
- Signed Session Lease + offline timer continuity
- Overlays/warnings/messages/next booking/challenges
- Station readiness and owner override with audit
- Fleet versions/updates/diagnostics/safe restart
- Controllers/assets usage and predictive maintenance
- Technical observability cockpit
- Safe auto-heal runbooks
- Emergency Takeover and local authority failover foundations

## PHASE 3 — TRUST, OWNER & PROFIT ENGINE
Goal: protect the owner and turn operations into measurable profit decisions.

Scope:
- Roles/permissions/auth enforcement
- Append-only hash-chained audit + sealed export
- Digital Twin / Time Machine
- Owner Sentinel / suspicious activity workflow
- Venue Health Score
- Daily Owner Brief
- Opening/Closing Autopilot
- Staff Task Engine
- Profit Autopilot + NextBestAction
- Revenue Lab scenarios
- Smart Seat, Dynamic Loyalty, Lost Revenue Meter
- Forecast engine, Inventory Brain, Menu Engineering, Hardware ROI
- Experiment/Attribution Lab
- Monthly Value Report

## PHASE 4 — PLAYER, COMMUNITY & MEDIA GROWTH
Goal: make players return, compete, buy more and create networkable engagement.

Scope:
- Player QR/PWA integration contracts
- Extension/order/staff request/queue/receipt/points flows
- Missions/Battle Pass, churn, Player DNA
- Membership UX, referrals, vouchers, service recovery
- Party/group/event mode
- Elo, Matchmaker, King, Tournament Autopilot
- Spectator/venue live mode
- Game Demand + Release Command Center + License Vault
- No Dark Station + campaign engine + cached playlists
- Proof of Play + sponsor ROI + redemption attribution
- Brand safety and sponsor exchange foundation

## PHASE 5 — SAAS WORLD / SYNC / AI / NETWORK
Goal: turn the standalone Venue OS into a global multi-site SaaS without making local operations cloud-dependent.

Scope:
- Versioned Web/Edge/Android sync contract
- Pairing/handshake/outbox/inbox/cursors/conflicts/idempotency
- Authority lease, emergency primary, deterministic reconciliation
- Multi-tenant tenant/venue/branch isolation
- Edge Data Plane + Cloud Control Plane
- Owner Remote, Franchise/HQ, white-label
- Offline SaaS entitlement lease
- Zero-to-Live onboarding + competitor import/migration
- FR/AR/EN + RTL + currency/timezone/tax abstraction
- SaaS observability/SLO/support bundles/remote config
- AI Operator: READ -> DRAFT -> APPROVAL -> EXECUTE
- Automation rules engine
- Plugin/Adapter SDK + security
- Gaming Passport, Cross-Venue League, anonymous benchmarks
- Adapter marketplace and network privacy guard

## RELEASE RULE
No more micro-APK releases. Development commits may be numerous, but an APK is produced only at a meaningful phase checkpoint or a critical regression fix.

## DEFINITION OF DONE
A capability is implemented only when the applicable layers exist: domain model, authoritative persistence, command/API, permission, event/audit, idempotency/concurrency, connected UI, settings/feature flag, tests, docs, migration/backward compatibility, offline/degraded behavior.
