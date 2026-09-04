# LA PAUSE OS 2.5 — Scalable SaaS module catalog

## Product rule
LA PAUSE OS is sold as a modular SaaS. Customers pay only for the business capabilities they activate.

This catalog is designed to scale from:
- one small PS-only venue,
- one multi-activity venue,
- several homogeneous venues,
- several heterogeneous venues,
- a managed group with owner/head-office reporting.

The commercial model is capability-based, not PS5-based.

---

## 1. Account hierarchy

`TENANT / ORGANIZATION`
→ `VENUE / BRANCH`
→ `ACTIVITY / METIER`
→ `RESOURCE`
→ `SESSION / TICKET / CUSTOMER / DEVICE`

Examples:
- Tenant A → 1 venue → Console only → 6 PS5.
- Tenant B → 1 venue → Console + SIM + Billiard.
- Tenant C → 4 venues → Console only in all venues.
- Tenant D → 5 venues → different activity mixes per venue.

The UI must contract or expand according to the tenant topology and purchased modules.

---

## 2. Commercial building blocks

Each commercial item has:
- `id`
- `name`
- `category`
- `billingScope`: TENANT | VENUE | RESOURCE | USER | USAGE
- `monthlyPriceMAD`
- `dependencies[]`
- `features[]`
- `includedLimits{}`
- `overageRules{}`
- `assignableToVenues`: boolean
- `trialDays`
- `status`

Modules can be activated tenant-wide or assigned only to selected venues where relevant.

---

## 3. Base core

### CORE_OPERATIONS — 99 MAD / month / venue
**Purpose:** pure venue management without forcing cash, accounting, CRM or marketing.

Includes:
- multi-activity resource management,
- Console / SIM / PC / Billiard / Snooker / Table Tennis / Private Room / Arcade / Custom,
- session start/finish/pause/extend,
- per-time / block / fixed / per-game / per-player-game / custom billing models,
- dynamic activity/game media,
- local history,
- offline-first storage,
- basic pricing configuration,
- basic reservations view,
- local backup/export,
- one owner/admin account,
- one venue.

Does NOT include advanced cash control, accounting, CRM, marketing, devices, cloud multi-device sync or multi-venue head-office.

This is the minimum paid commercial foundation.

---

## 4. Operational modules

### CASH_POS — 39 MAD / month / venue
Purpose: cash desk and payment operations.

Includes:
- cash shifts,
- opening float,
- payment methods,
- cash in/out,
- outstanding balances,
- bundled session + snack payment,
- cash variance,
- end-of-shift close.

Dependency: `CORE_OPERATIONS`.

### STOCK_COMMERCE — 39 MAD / month / venue
Purpose: snacks, drinks, products and stock.

Includes:
- product catalog,
- session-linked orders,
- quick counter sale,
- live ticket snack visibility,
- stock movement,
- low-stock alerts,
- supplier/purchase tracking,
- product margin basics.

Dependency: `CORE_OPERATIONS`.

### RESERVATIONS_QUEUE — 29 MAD / month / venue
Purpose: future demand and customer arrival flow.

Includes:
- reservations,
- queue,
- arrivals,
- resource preference,
- wait estimates,
- no-show/cancel states,
- upcoming demand panel.

Dependency: `CORE_OPERATIONS`.

### EVENTS_COMPETITION — 39 MAD / month / venue
Purpose: tournaments, challenges and community competition.

Includes:
- tournaments,
- brackets/progression,
- challenges,
- leaderboard,
- king-of-the-room,
- match results,
- Elo/local rankings.

Dependency: `CORE_OPERATIONS`.

---

## 5. Customer / growth modules

### CRM_LOYALTY — 49 MAD / month / venue
Purpose: identify customers and increase repeat visits.

Includes:
- customer profiles,
- visit/spend history,
- loyalty points,
- passes/subscriptions,
- segments,
- customer DNA,
- favorite activity/game,
- referral basics,
- churn score.

Dependency: `CORE_OPERATIONS`.

### MARKETING_GROWTH — 69 MAD / month / venue
Purpose: turn operational data into revenue actions.

Includes:
- next-best-action prompts,
- extension offers,
- snack attach opportunities,
- customer reactivation lists,
- campaigns,
- offers/coupons,
- missions,
- referral campaigns,
- demand voting,
- campaign performance.

Dependencies:
- `CORE_OPERATIONS`
- `CRM_LOYALTY`

Marketing never creates fake clients. Anonymous remains `Non identifié`.

---

## 6. Finance modules

### ACCOUNTING_LITE — 59 MAD / month / venue
Purpose: operational accounting for owners/managers.

Includes:
- revenue categories,
- expenses,
- purchases,
- daily P&L view,
- margin by activity,
- margin by product,
- payment reconciliation,
- cash vs recorded sales,
- daily/monthly exports.

Dependencies:
- `CORE_OPERATIONS`
- `CASH_POS`

### ACCOUNTING_PRO — 99 MAD / month / venue
Purpose: deeper finance and management control.

Includes everything in Accounting Lite plus:
- supplier balances,
- cost allocation,
- recurring expenses,
- VAT/tax-ready export fields,
- activity profitability,
- venue profitability,
- period comparison,
- manager closing checklist,
- advanced export/API hooks.

Dependencies:
- `CORE_OPERATIONS`
- `CASH_POS`
- `ACCOUNTING_LITE`

Commercial rule: customer pays the delta, not Lite + Pro twice. Pro supersedes Lite in billing.

---

## 7. Hardware / automation modules

### DEVICE_CONTROL — 79 MAD / month / venue
Purpose: control and monitor connected machines/screens/agents.

Includes:
- Device Mesh,
- Android TV Agent,
- Windows Agent when available,
- pairing,
- health,
- commands,
- session lifecycle automation,
- TV messages/overlay where technically supported,
- device alerts,
- secure credential storage.

Dependency: `CORE_OPERATIONS`.

### AUTOMATIONS — 59 MAD / month / tenant
Purpose: rules and hands-free operations.

Includes:
- business rules,
- session lifecycle automations,
- follow-up actions,
- operator reminders,
- device orchestration rules,
- approval-required smart actions.

Dependencies depend on the automation target. Example: device automation requires `DEVICE_CONTROL`.

---

## 8. Owner / analytics modules

### INSIGHTS_PRO — 69 MAD / month / tenant
Purpose: owner decision layer.

Includes:
- revenue analytics,
- utilization,
- average ticket,
- customer retention,
- snack attach rate,
- lost-revenue indicators,
- forecast,
- next-best-actions,
- daily owner brief,
- anomaly summary.

Dependency: `CORE_OPERATIONS` on at least one venue.

### AUDIT_SECURITY_PRO — 39 MAD / month / tenant
Purpose: trust, roles and traceability.

Includes:
- detailed audit trail,
- suspicious-event review,
- role permissions,
- manager/staff/viewer roles,
- sensitive action log,
- cash variance alerts.

Dependency: `CORE_OPERATIONS`.

---

## 9. SaaS / cloud / scale modules

### CLOUD_SYNC — 49 MAD / month / venue
Purpose: multi-device operation and cloud continuity.

Includes:
- cloud sync,
- tablet ↔ web/PC synchronization,
- outbox/inbox sync,
- conflict handling,
- remote configuration,
- cloud backup,
- secure entitlement refresh.

Dependency: `CORE_OPERATIONS`.

### TEAM_ACCESS — 29 MAD / month / venue
Includes up to 5 staff users.
Additional staff user: 5 MAD / user / month.

Includes:
- staff accounts,
- role assignment,
- shift attribution,
- operator activity attribution.

Dependency: `CORE_OPERATIONS`.

### MULTI_VENUE — 149 MAD / month / tenant
Purpose: head-office / group management.

Includes:
- organization switcher,
- multiple venues,
- venue-specific activities/modules,
- cross-venue owner dashboard,
- consolidated revenue,
- venue comparison,
- group-wide CRM visibility where allowed,
- centralized module assignment,
- centralized owner permissions.

Includes 3 venues in the multi-venue management layer.
Additional managed venue beyond the first 3: 29 MAD / venue / month.

Important: each venue still needs its own `CORE_OPERATIONS` license because it is an operational instance.

### API_CONNECTORS — 79 MAD / month / tenant
Purpose: third-party integration and export automation.

Includes:
- public business API entitlement,
- accounting export connector hooks,
- approved webhooks,
- external BI connector support,
- selected integration adapters.

Dependencies vary by connector.

---

## 10. Pricing examples

### Example A — small PS-only room, management only
- CORE_OPERATIONS: 99
Total: **99 MAD/month**

Visible app: Today + Console operations + basic System. No cash/CRM/marketing clutter.

### Example B — PS room with cash + snacks
- CORE_OPERATIONS: 99
- CASH_POS: 39
- STOCK_COMMERCE: 39
Total: **177 MAD/month**

### Example C — one multi-activity venue with growth stack
- CORE_OPERATIONS: 99
- CASH_POS: 39
- STOCK_COMMERCE: 39
- CRM_LOYALTY: 49
- MARKETING_GROWTH: 69
- RESERVATIONS_QUEUE: 29
Total: **324 MAD/month**

### Example D — one premium venue with devices + finance + insights
- CORE_OPERATIONS 99
- CASH_POS 39
- STOCK_COMMERCE 39
- CRM_LOYALTY 49
- MARKETING_GROWTH 69
- ACCOUNTING_PRO 99
- DEVICE_CONTROL 79
- INSIGHTS_PRO 69
- CLOUD_SYNC 49
Total: **591 MAD/month**

### Example E — owner with 4 PS-only venues, management + cash + cloud + head office
Per venue:
- CORE_OPERATIONS 99
- CASH_POS 39
- CLOUD_SYNC 49
= 187 × 4 = 748
Tenant:
- MULTI_VENUE 149, includes group layer for first 3 venues
- 1 additional managed venue = 29
Total: **926 MAD/month**

### Example F — owner with 4 heterogeneous venues
Same licensing logic as Example E, but modules are assigned per venue.
Venue 1 can have only Core + Cash.
Venue 2 can add Billiard/Snooker workflows without extra activity-type license because activity support is part of Core.
Venue 3 can add Device Control.
Venue 4 can add CRM + Marketing.
The tenant pays only for modules actually assigned.

---

## 11. Entitlement behavior in the UI

Locked modules are not shown as broken/disabled normal pages.

Rules:
- Core navigation shows only purchased capabilities.
- Launcher may show selected locked modules as upgrade cards with price and business benefit.
- Entering a locked module opens a clean upgrade sheet, never an error toast.
- Dependency upgrades are explained explicitly.
- Module unlock is based on entitlement IDs, never hard-coded UI checks.
- Offline entitlement cache must allow a grace period so the venue never becomes unusable because the network is down.
- `CORE_OPERATIONS` remains usable during cloud failure.

---

## 12. Entitlement schema

```json
{
  "catalogVersion": "2026.09",
  "tenantId": "tenant-...",
  "subscription": {
    "status": "ACTIVE",
    "currency": "MAD",
    "renewalAt": 0
  },
  "items": [
    {
      "moduleId": "CORE_OPERATIONS",
      "scope": "VENUE",
      "scopeId": "venue-1",
      "quantity": 1,
      "status": "ACTIVE",
      "validUntil": null,
      "source": "SUBSCRIPTION"
    }
  ]
}
```

Feature checks use:
`hasModule(moduleId, {venueId, tenantId})`

Never use direct plan-name checks such as `if(plan==='PRO')`.

---

## 13. Scale rules

1. Activities are configuration, not paid modules.
2. Business capabilities are paid modules.
3. Modules can be assigned per venue where it makes business sense.
4. Tenant modules apply once at group level.
5. Multi-venue does not duplicate operational licenses; it adds group/head-office capability.
6. Quantity billing is explicit for additional venues/users/resources where introduced.
7. Module dependencies are machine-readable.
8. UI navigation derives from entitlements + tenant topology + user role.
9. SaaS entitlement failure must never corrupt local venue data.
10. Every module has its own QA gate and can be enabled/disabled without breaking Core.

---

## 14. Next implementation contract

The v2.5 shell must implement:
- module catalog in code,
- `hasModule()` entitlement resolver,
- topology model (tenant/venues/activities/resources),
- adaptive navigation,
- upgrade cards,
- subscription/modules screen,
- module-aware permissions,
- offline entitlement cache/grace,
- module-specific route guards,
- test matrix for small single-venue, multi-activity, multi-venue homogeneous and multi-venue heterogeneous tenants.
