# LA PAUSE OS — ANDROID FEATURE IMPLEMENTATION MATRIX
Baseline: v1.6.0 current APK. Source: Master V2 Audited 3420 lines.
Statuses: EXISTING_VERIFIED / FOUNDATION_PRESENT / PARTIAL / TO_IMPLEMENT / BLOCKED_EXTERNAL / FUTURE_DISABLED.

| ID | Feature | Android role | Baseline status | Target phase |
|---|---|---|---|---|
| CORE-01 | Gaming Floor | EXECUTE | EXISTING_VERIFIED | A4 |
| CORE-02 | PS5/SIM sessions | EXECUTE | EXISTING_VERIFIED | A2 |
| CORE-03 | Generic resources | EXECUTE | FOUNDATION_PRESENT | A1/A4 |
| CORE-04 | Timed/budget/free/formula/pass sessions | EXECUTE | EXISTING_VERIFIED | A2 |
| CORE-05 | Pause/resume/extend/move/end | EXECUTE | EXISTING_VERIFIED | A2 |
| CORE-06 | Prepayment invariant | EXECUTE | EXISTING_VERIFIED | A2 |
| CORE-07 | Queue | EXECUTE | EXISTING_VERIFIED | A2/A4 |
| CORE-08 | Bookings/check-in/no-show | EXECUTE | EXISTING_VERIFIED | A2/A4 |
| CORE-09 | Opening/closing autopilot | EXECUTE | TO_IMPLEMENT | A6 |
| FIN-01 | Shift open/close | EXECUTE | EXISTING_VERIFIED | A2 |
| FIN-02 | Payments | EXECUTE | EXISTING_VERIFIED | A2 |
| FIN-03 | Cash movements | EXECUTE | PARTIAL | A2 |
| FIN-04 | Expenses/corrections | EXECUTE | PARTIAL | A2 |
| FIN-05 | Full refund | EXECUTE | PARTIAL | A2 |
| FIN-06 | Partial refund/credit/exchange | EXECUTE | TO_IMPLEMENT | A2 |
| FIN-07 | Receipts | EXECUTE/VIEW | PARTIAL | A2 |
| FIN-08 | Split bill/group tab | EXECUTE | TO_IMPLEMENT | A8 |
| CRM-01 | Guest/customer/member | EXECUTE | PARTIAL | A2/A8 |
| CRM-02 | CRM/history | EXECUTE | EXISTING_VERIFIED | A2 |
| CRM-03 | Consent evidence | EXECUTE/VIEW | PARTIAL | A2/A6 |
| CRM-04 | Player DNA | VIEW/CONTROL | TO_IMPLEMENT | A8 |
| CRM-05 | Segments | VIEW/CONTROL | TO_IMPLEMENT | A8 |
| CRM-06 | Guardian/family mode | EXECUTE | TO_IMPLEMENT | A8 |
| LOY-01 | Loyalty ledger | EXECUTE | PARTIAL | A2 |
| LOY-02 | Prepaid passes | EXECUTE | EXISTING_VERIFIED | A2 |
| LOY-03 | Memberships | EXECUTE | PARTIAL | A2/A8 |
| LOY-04 | Venue credits/vouchers | EXECUTE | TO_IMPLEMENT | A2/A8 |
| LOY-05 | Referrals/gifts | EXECUTE | TO_IMPLEMENT | A8 |
| STOCK-01 | Product catalogue | EXECUTE | EXISTING_VERIFIED | A2 |
| STOCK-02 | Sales/orders | EXECUTE | EXISTING_VERIFIED | A2 |
| STOCK-03 | Stock movements | EXECUTE | PARTIAL | A2 |
| STOCK-04 | Suppliers/purchase orders | EXECUTE | EXISTING_VERIFIED | A2/A4 |
| STOCK-05 | Goods receipts | EXECUTE | PARTIAL | A4 |
| STOCK-06 | Physical stock counts | EXECUTE | TO_IMPLEMENT | A4 |
| DEV-01 | Device registry | CONTROL | PARTIAL | A5 |
| DEV-02 | Pairing | CONTROL | TO_IMPLEMENT | A3/A5 |
| DEV-03 | Heartbeat health | VIEW | PARTIAL | A5 |
| DEV-04 | Signed session lease | CONTROL | TO_IMPLEMENT | A5 |
| DEV-05 | Overlay engine | CONTROL | PARTIAL | A5 |
| DEV-06 | Fleet/version manager | CONTROL | TO_IMPLEMENT | A5 |
| DEV-07 | Controller asset identity | EXECUTE | PARTIAL | A5 |
| DEV-08 | Predictive maintenance | VIEW/CONTROL | PARTIAL | A5 |
| DEV-09 | Technical observability | VIEW | TO_IMPLEMENT | A5 |
| DEV-10 | Safe auto-heal | CONTROL | TO_IMPLEMENT | A5 |
| TRUST-01 | Append-only audit | VIEW | PARTIAL | A6 |
| TRUST-02 | Time Machine | VIEW | TO_IMPLEMENT | A6 |
| TRUST-03 | Owner Sentinel | VIEW/APPROVE | TO_IMPLEMENT | A6 |
| TRUST-04 | Team auth/permissions | EXECUTE | PARTIAL | A6 |
| TRUST-05 | Venue Health Score | VIEW | TO_IMPLEMENT | A6 |
| TRUST-06 | Daily Owner Brief | VIEW | TO_IMPLEMENT | A6 |
| TRUST-07 | Staff task engine | EXECUTE | TO_IMPLEMENT | A6 |
| REV-01 | Profit Autopilot | VIEW/APPROVE | TO_IMPLEMENT | A7 |
| REV-02 | Revenue Lab | VIEW/CONTROL | TO_IMPLEMENT | A7 |
| REV-03 | Dynamic Loyalty | APPROVE | TO_IMPLEMENT | A7 |
| REV-04 | Smart Seat | EXECUTE/APPROVE | TO_IMPLEMENT | A7 |
| REV-05 | Lost Revenue Meter | VIEW | TO_IMPLEMENT | A7 |
| REV-06 | Automation ROI | VIEW | TO_IMPLEMENT | A7 |
| REV-07 | Inventory Brain | VIEW/APPROVE | TO_IMPLEMENT | A7 |
| REV-08 | Menu Engineering | VIEW | TO_IMPLEMENT | A7 |
| REV-09 | Hardware ROI | VIEW | TO_IMPLEMENT | A7 |
| REV-10 | Unified Forecast | VIEW | TO_IMPLEMENT | A7 |
| REV-11 | Experiment/Attribution | VIEW/CONTROL | TO_IMPLEMENT | A7 |
| REV-12 | Energy optimizer | VIEW/APPROVE | TO_IMPLEMENT | A7 |
| REV-13 | Staff planner | VIEW | TO_IMPLEMENT | A7 |
| REV-14 | Monthly Value Report | VIEW | TO_IMPLEMENT | A7 |
| PLAYER-01 | Player QR/PWA control | CONTROL | PARTIAL | A8 |
| PLAYER-02 | One-tap revenue moments | APPROVE | TO_IMPLEMENT | A8 |
| PLAYER-03 | Missions/Battle Pass | CONTROL | TO_IMPLEMENT | A8 |
| PLAYER-04 | Churn Radar | VIEW/APPROVE | TO_IMPLEMENT | A8 |
| PLAYER-05 | Service requests | EXECUTE | TO_IMPLEMENT | A8 |
| PLAYER-06 | Service recovery | APPROVE/EXECUTE | TO_IMPLEMENT | A8 |
| PLAYER-07 | Party/group mode | EXECUTE | TO_IMPLEMENT | A8 |
| PLAYER-08 | Smart reservation | EXECUTE | PARTIAL | A8 |
| PLAYER-09 | Experience Score | VIEW | TO_IMPLEMENT | A8 |
| PLAYER-10 | Responsible play | CONTROL | TO_IMPLEMENT | A8 |
| COMP-01 | Tournaments | EXECUTE | EXISTING_VERIFIED | A9 |
| COMP-02 | Challenges | EXECUTE | EXISTING_VERIFIED | A9 |
| COMP-03 | King | EXECUTE | EXISTING_VERIFIED | A9 |
| COMP-04 | Local Elo | VIEW/EXECUTE | TO_IMPLEMENT | A9 |
| COMP-05 | Matchmaker | EXECUTE | TO_IMPLEMENT | A9 |
| COMP-06 | Tournament Autopilot | EXECUTE | PARTIAL | A9 |
| COMP-07 | Spectator mode | CONTROL | TO_IMPLEMENT | A9 |
| COMP-08 | Game Demand Intelligence | VIEW | TO_IMPLEMENT | A9 |
| COMP-09 | Release Command Center | CONTROL | TO_IMPLEMENT | A9 |
| COMP-10 | Game/license/account vault | CONTROL | TO_IMPLEMENT | A9 |
| MEDIA-01 | No Dark Station | CONTROL | TO_IMPLEMENT | A10 |
| MEDIA-02 | Campaign engine | CONTROL | PARTIAL | A10 |
| MEDIA-03 | Offline creative cache | CONTROL | TO_IMPLEMENT | A10 |
| MEDIA-04 | Proof of Play | VIEW | TO_IMPLEMENT | A10 |
| MEDIA-05 | Sponsor ROI | VIEW | TO_IMPLEMENT | A10 |
| MEDIA-06 | Sponsor Exchange | VIEW | FUTURE_DISABLED | A12 |
| MEDIA-07 | Brand safety | APPROVE | TO_IMPLEMENT | A10 |
| SYNC-01 | Standalone mode | EXECUTE | FOUNDATION_PRESENT | A1 |
| SYNC-02 | Connected local mode | EXECUTE | FOUNDATION_PRESENT | A1/A3 |
| SYNC-03 | Pairing handshake | EXECUTE | TO_IMPLEMENT | A3 |
| SYNC-04 | Outbox/inbox | EXECUTE | FOUNDATION_PRESENT | A2/A3 |
| SYNC-05 | Cursor/checkpoint | EXECUTE | TO_IMPLEMENT | A3 |
| SYNC-06 | Conflict resolver | EXECUTE | TO_IMPLEMENT | A3 |
| SYNC-07 | Authority lease/failover | EXECUTE | TO_IMPLEMENT | A3 |
| SYNC-08 | Web backend sync API | CONSUME | BLOCKED_EXTERNAL | A3 |
| SAAS-01 | Multi-tenant IDs | MODEL | TO_IMPLEMENT | A2/A11 |
| SAAS-02 | Owner Remote | VIEW/APPROVE | TO_IMPLEMENT | A11 |
| SAAS-03 | Franchise/HQ | VIEW/CONTROL | TO_IMPLEMENT | A11 |
| SAAS-04 | White label | CONTROL | TO_IMPLEMENT | A11 |
| SAAS-05 | SaaS entitlement offline lease | EXECUTE | TO_IMPLEMENT | A11 |
| SAAS-06 | Zero-to-Live onboarding | EXECUTE | TO_IMPLEMENT | A11 |
| SAAS-07 | Import/migration wizard | EXECUTE | TO_IMPLEMENT | A11 |
| SAAS-08 | FR/AR/EN + RTL | EXECUTE | PARTIAL | A11 |
| SAAS-09 | Support bundle | EXECUTE | TO_IMPLEMENT | A11 |
| AI-01 | AI Operator | VIEW/APPROVE | TO_IMPLEMENT | A12 |
| AI-02 | Natural-language forensics | VIEW | TO_IMPLEMENT | A12 |
| AI-03 | Automation engine | CONTROL/APPROVE | TO_IMPLEMENT | A12 |
| NET-01 | Gaming Passport | VIEW | FUTURE_DISABLED | A12 |
| NET-02 | Cross-Venue League | VIEW/CONTROL | FUTURE_DISABLED | A12 |
| NET-03 | Anonymous benchmarks | VIEW | FUTURE_DISABLED | A12 |
| NET-04 | Adapter marketplace | CONTROL | FUTURE_DISABLED | A12 |
| INFRA-01 | SQLite/WAL local core | EXECUTE | FOUNDATION_PRESENT | A2 |
| INFRA-02 | Legacy snapshot recovery | EXECUTE | EXISTING_VERIFIED | A0 |
| INFRA-03 | Rolling backups/checksum | EXECUTE | PARTIAL | A2 |
| INFRA-04 | Event schema registry | MODEL | TO_IMPLEMENT | A2 |
| INFRA-05 | Scheduler/jobs | EXECUTE | TO_IMPLEMENT | A2 |
| INFRA-06 | Notification orchestrator | EXECUTE | PARTIAL | A2/A8 |
| INFRA-07 | Data governance | CONTROL | TO_IMPLEMENT | A6/A11 |
| INFRA-08 | Secrets/key rotation | EXECUTE | PARTIAL | A3/A6 |
| INFRA-09 | Business Time Engine | EXECUTE | PARTIAL | A2 |
| INFRA-10 | Feature flags/entitlements | EXECUTE | TO_IMPLEMENT | A1/A11 |

## First implementation checkpoint
v1.7.0-alpha1:
- keep all v1.5/v1.6 behavior
- expose correct LA PAUSE OS version
- visible Mode & Sync center
- standalone/connected-local switch backed by CoreStore
- display core health, authority, snapshots/resources/events/outbox
- do not claim real Web sync until handshake exists
- prepare connection profile + pairing contract
- preserve rates 22/28/45 and payment-at-start
