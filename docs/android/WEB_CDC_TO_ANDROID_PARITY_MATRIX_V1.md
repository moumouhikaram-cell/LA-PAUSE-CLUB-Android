# LA PAUSE OS — WEB CDC → ANDROID PARITY MATRIX V1

This matrix is the binding adaptation of the Web CDC to Android. Android must remain fast and autonomous offline, but domain meaning and sync contracts must stay compatible with Web/Edge.

Statuses: `IMPLEMENTED_LOCAL`, `PARTIAL`, `BLOCKED_EXTERNAL`, `TO_VERIFY_CI`.

| Web CDC block | Android parity requirement | Current Android direction | Status |
|---|---|---|---|
| Business hardening | No fake success; rollback-safe writes; revision/idempotency metadata | normalized SQLite Core + snapshots + event/command outboxes | TO_VERIFY_CI |
| Cash / shifts | One open/close model, real movements, expenses != revenue, variance/reasons | P1 finance + shift/cash normalized tables | IMPLEMENTED_LOCAL |
| Payments / refunds | Ledger, full + partial refunds, credit notes/exchanges | payment ledger + P1 finance extensions | IMPLEMENTED_LOCAL |
| Stock / snacks | Traceable StockMovement, refund stock restoration | product/order/stock movement + stock counts/goods receipt | IMPLEMENTED_LOCAL |
| Customers / consent | Profile update must not recreate consent | separate `consentEvidence`, DB v8 evidence table | IMPLEMENTED_LOCAL |
| Member PIN security | Strong PIN hashing compatible with Web policy | Android secure secret infrastructure exists; member PIN parity requires final PBKDF2 migration validation | PARTIAL |
| Queue | WAITING→CALLED→SEATED; LEFT; timestamps | canonical state model and business tables | IMPLEMENTED_LOCAL |
| Backups | rolling recovery and corruption fallback | SharedPreferences backup + SQLite snapshots/checksums | IMPLEMENTED_LOCAL |
| API robustness | strict envelopes/IDs/types, no fallback full-state POST | `CommandEnvelope`, `DomainEventEnvelope`, `/v1/sync` contract | IMPLEMENTED_LOCAL |
| Team permissions | permissions must be enforced, not decorative | owner/trust layer exists; server enforcement remains Web authority when connected | PARTIAL |
| Normalized DB | progressive exit from giant JSON | DB v8 normalized domain stores + legacy recovery | IMPLEMENTED_LOCAL |
| Atomic transactions | sale/payment/stock/cash/audit/outbox all-or-rollback | Core SQLite transaction boundary; final command-level transactional write path still to prove by CI/tests | TO_VERIFY_CI |
| Tamper-evident audit | previousHash/hash + actor/device + before/after/diff | local hash-chain + Time Machine; server sealing when online | IMPLEMENTED_LOCAL |
| Loyalty Ledger | EARN/SPEND/EXPIRE/CORRECTION/REFUND | P1 loyalty ledger | IMPLEMENTED_LOCAL |
| Supplier purchases | PO, partial/full receipt, cost variance | existing purchases + goods receipt extensions | IMPLEMENTED_LOCAL |
| Reliable KPIs | gross/net/refunds/cash/card/occupancy/margin/wait/LTV | reports + P3 intelligence | IMPLEMENTED_LOCAL |
| Device Registry | stable deviceId/stationId, capabilities | P2 registry | IMPLEMENTED_LOCAL |
| TV/agent health | heartbeat, lastSeen, version, HDMI/errors/latency | P2 heartbeat/health contract | IMPLEMENTED_LOCAL; real agent BLOCKED_EXTERNAL |
| TV Fail-Safe | signed Session Lease, local timer, reconnect reconciliation | P2 SessionLease contract + authority/failover | IMPLEMENTED_LOCAL; TV execution BLOCKED_EXTERNAL |
| Station Readiness | READY/DEGRADED/BLOCKED with structured reasons | P1/P2 readiness | IMPLEMENTED_LOCAL |
| Anti-fraud | suspicious evidence, no automatic accusation | P3 Owner Sentinel / suspicious events | IMPLEMENTED_LOCAL |
| Hardware maintenance | QR identities, usage, drift/inspection/maintenance | P2 fleet/assets/maintenance | IMPLEMENTED_LOCAL |
| Fleet Manager | versions, compatibility, safe update/rollback | P2 fleet contracts | IMPLEMENTED_LOCAL; remote updater BLOCKED_EXTERNAL |
| Technical cockpit | server/realtime/storage/network/device errors | P2/P5 cockpits | IMPLEMENTED_LOCAL |
| Profit Autopilot | next action to improve revenue/margin/occupancy | P3 intelligence | IMPLEMENTED_LOCAL |
| Player QR/PWA | session self-service | Android can generate signed/temp QR contracts; hosted PWA remains BLOCKED_EXTERNAL | PARTIAL |
| Smart Seat | resource placement recommendation | P3 intelligence | IMPLEMENTED_LOCAL |
| Dynamic Loyalty | off-peak points recommendation | P3 intelligence | IMPLEMENTED_LOCAL |
| Lost Revenue Meter | quantified lost revenue with confidence | P3 owner/intelligence | IMPLEMENTED_LOCAL |
| Automation ROI | generated/protected MAD measurement | P3 intelligence | IMPLEMENTED_LOCAL |
| Digital Twin / Time Machine | reconstruct past venue state | Core snapshots/events + native Time Machine | IMPLEMENTED_LOCAL |
| Owner Sentinel | anomalies on refunds/cash/free sessions/stock/prices | P3 owner | IMPLEMENTED_LOCAL |
| Hardware ROI | payback/utilization/maintenance | P3 intelligence | IMPLEMENTED_LOCAL |
| TV Media Network | idle screens become media inventory | P4 experience/media contracts | IMPLEMENTED_LOCAL; playback agent BLOCKED_EXTERNAL |
| Proof-of-Play | exact acknowledged playback evidence | P4 proof records tied to device ACK | IMPLEMENTED_LOCAL; real ACK requires agent |
| Battle Pass / Missions | commercial missions | P4 player | IMPLEMENTED_LOCAL |
| Churn Radar | detect disappearing regular | P4 player | IMPLEMENTED_LOCAL |
| Player DNA | games/time/duration/seat preference | P4 player | IMPLEMENTED_LOCAL |
| Matchmaker / Elo | opponent and local rating | P4 player/competition | IMPLEMENTED_LOCAL |
| Tournament Autopilot | registration→payment→winner→ROI | existing competition + P4 automation | IMPLEMENTED_LOCAL |
| King automated | king state/history/notifications | existing v1.5 + P4 | IMPLEMENTED_LOCAL |
| Inventory Brain | stockout forecast / reorder | P3 intelligence | IMPLEMENTED_LOCAL |
| Game Demand | requested/played/refused/licensing signal | P4 experience | IMPLEMENTED_LOCAL |
| Release Center | copies/update/storage/tournament/booking/snacks/content | P4 experience | IMPLEMENTED_LOCAL |
| Party / Group | resources+time+snacks+deposit+bill | P4 experience + split bill | IMPLEMENTED_LOCAL |
| Service Recovery | incident→compensation→cost→approval→return | P4 player/experience | IMPLEMENTED_LOCAL |
| AI Operator | analyze→draft→approve→execute | P5 AI drafts/tool allowlist | IMPLEMENTED_LOCAL; external LLM optional |
| Natural Language Forensics | query real ledgers | local forensics engine; external LLM optional | IMPLEMENTED_LOCAL |
| Daily Owner Brief | short recap + decisions | P3 owner | IMPLEMENTED_LOCAL |
| Gaming Passport | opt-in network identity | P5 model/consent | IMPLEMENTED_LOCAL; cross-venue backend BLOCKED_EXTERNAL |
| Cross-Venue Leagues | venue→city→region→national | contracts only | BLOCKED_EXTERNAL |
| Sponsor Exchange | multi-venue ad marketplace | contracts/flags only | BLOCKED_EXTERNAL |
| Network Benchmarks | anonymous cohort comparison | cohort/privacy gates modeled | BLOCKED_EXTERNAL |
| Franchise / HQ | central policies/templates/catalogs/audits | P5 tenant/venue/branch model | PARTIAL; cloud control plane BLOCKED_EXTERNAL |
| White Label | logo/domain/receipts/portal/TV | local theme config + contracts | IMPLEMENTED_LOCAL; hosted portal BLOCKED_EXTERNAL |
| Adapter Marketplace / SDK | payment/printer/TV/accounting/etc adapters | adapter registry + security model | IMPLEMENTED_LOCAL; individual adapters external |

## Non-negotiable parity rules
1. Same canonical entity IDs across Android/Web after pairing.
2. Same state machines for Session, Queue, Booking, Payment/Refund, Shift, Readiness, Device health.
3. Same money semantics: integer minor units in normalized storage and sync.
4. Same revision/idempotency semantics.
5. Deletion travels as a tombstone, never silent absence.
6. Consent evidence is independent from profile mutation.
7. Financial conflicts never auto-merge.
8. Android never displays CONNECTED until handshake succeeds.
9. Offline venue operations continue without Web/Cloud.
10. Reconnect uses replay + reconciliation, never whole-state overwrite.
