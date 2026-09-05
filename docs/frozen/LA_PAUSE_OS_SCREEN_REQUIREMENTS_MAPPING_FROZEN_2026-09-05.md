# LA PAUSE OS — FROZEN SCREEN / REQUIREMENTS MAPPING
## Les 44 templates restent visuellement figés. Cette matrice indique où brancher les fonctions sans modifier la composition canonique.

| Screen | Surface figée | Exigences principales à brancher |
|---:|---|---|
| 01 | Sales Landing / Home | SaaS vendable, plans/modules, multi-tenant, Edge+Cloud, Player Engagement |
| 02 | SaaS Sign In | Auth, tenant-aware login, security, SSO readiness |
| 03 | Create Account | Account, identity, locale |
| 04 | Create Organization | Organization/Tenant, country, business type, plan |
| 05 | Workspace / Tenant Selector | Multi-tenant, workspace switching, isolation |
| 06 | Venue Selector | Venue templates, business type |
| 07 | Branch Selector | Branch, multi-site |
| 08 | Zero-to-Live Onboarding | Onboarding complet, readiness, blockers, tests GO LIVE |
| 09 | Business Model & Pricing | Time/budget/fixed/open/per-game, pricing rules |
| 10 | Resource Setup / Floor Builder | 8 resource types, zones, devices, capabilities |
| 11 | Owner Command Center | Owner remote, revenue, venues, alerts, approvals |
| 12 | Operator Control Center | Operator-first, actions immédiates, queue, ending sessions |
| 13 | Revenue Moments | Upsell, flash promo, empty stations, re-engagement |
| 14 | Next Best Action & Alerts | NBA réel, acceptedActions, assistedRevenue |
| 15 | Gaming Floor Overview | Universal resources, media dynamiques, status |
| 16 | New Console Session | PS5/console time/budget/fixed/open, Duo 30 ≤3 actions |
| 17 | Billiard / Snooker Per Game | 1/3/5 games, +1 game, aucun timer négatif |
| 18 | Active Session Cockpit | extend, snack, notes, client, payment status |
| 19 | Extensions & Upsell Drawer | +30/+1h/+2h, +1 game, snack, combos |
| 20 | POS / Smart Cart | Cart, barcode/SKU, tabs, split bill |
| 21 | Cash Register / Shift | shift, float, cash drop, reconciliation |
| 22 | Product Catalog / Inventory Quick Sale | products, images, stock, price/cost/margin |
| 23 | Assisted Revenue / Offer Engine | AI-assisted upsell, attribution |
| 24 | CRM / Client 360 | guest/member, history, consent, tags, actions |
| 25 | Memberships / Loyalty / Passes | points, passes, credits, referral |
| 26 | Bookings Calendar | booking/check-in/no-show/reschedule/resource assignment |
| 27 | Queue / Waitlist | estimated wait, auto-assign, notify next |
| 28 | Tournaments / Brackets | tournament A→Z, scores, winner, profit |
| 29 | Devices Fleet Overview | registry, heartbeat, health |
| 30 | Device Detail / Pairing / Overlay | pairing, capabilities, overlay truthful state |
| 31 | Incidents / Maintenance | incidents, maintenance, safe auto-heal |
| 32 | Analytics Overview | real KPIs, revenue, occupancy, trends |
| 33 | Revenue Intelligence / Forecast | forecast, hardware ROI, attribution |
| 34 | Owner Remote Multi-site | branches, devices, backups, drill-down |
| 35 | Franchise / HQ Controls | policies, templates, pricing, catalog, benchmarks |
| 36 | Team & RBAC | roles, permissions, scopes |
| 37 | Subscription / Entitlements / Modules | M01→M15, plan, trial, grace, lease |
| 38 | Integrations / API / Webhooks | API keys, webhooks, sync/integrations |
| 39 | White Label / Branding Studio | brand/logo/domain/PWA/TV/receipt |
| 40 | Settings / Business Config | business, pricing, payments, notifications, locale |
| 41 | Security / Audit / Owner Sentinel | audit, Time Machine, MFA, risk |
| 42 | Mobile Operator App | phone portrait, one-hand actions, swipe-back |
| 43 | Tablet Operator App | tablet, floor grid, touch targets |
| 44 | System States | empty/loading/offline/permission/subscription blocked |

## Cross-cutting — obligatoire sur toutes les surfaces concernées
- Navigation interne, swipe droite→retour, bouton Android Back non destructif.
- Rotation sans perte d’état.
- Persistance.
- Offline Edge local.
- tenantId / venueId / branchId.
- Audit append-only.
- Idempotency.
- FR / AR RTL / EN.
- Images HD responsives/dynamiques.
- Aucun fake KPI / fake device success / faux AI.
- Web/Android parity.
- Migration non destructive.
