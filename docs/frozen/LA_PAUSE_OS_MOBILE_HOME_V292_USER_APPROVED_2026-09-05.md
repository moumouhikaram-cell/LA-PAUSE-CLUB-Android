# LA PAUSE OS — Mobile Home v292 — User-approved reference

Date: 2026-09-05
Status: USER APPROVED FOR IMPLEMENTATION
Scope: Mobile owner/operator Home (screen 42 presentation layer only)

Reference image SHA-256:
`52cf530ff9349484859d0793d41145424a8008354dfd0b3bda17d3592702fbcb`

## Visual contract

The mobile Home must reproduce the approved reference as closely as practical on a Samsung A07-class portrait viewport while preserving real dynamic data and existing engine behavior.

Required visible sections, without any `View All` shortcut:

- LA PAUSE OS header, venue selector and operator badge.
- Compact venue hero with real venue image and local/online status.
- Six always-visible KPIs: Live Players, Active Stations, Occupancy Rate, Today Revenue, Avg Session Time, Snack Sales Today.
- Three quick actions: Start Session, End Session, Extend Time.
- Game Categories grouped by business resource category, not game genre: PS5, SIM Racing, PC Gaming, Billiard; additional real resource groups may append only when configured.
- Live Stations grouped by those same categories, with every visible station represented by truthful state chips when space permits and real categories retained in the engine.
- Snacks & Drinks summary and product cards using real packaged media; unconfigured slots must never claim fake stock.
- Busiest-category / Next Best Action insight banner.
- Mobile bottom navigation: Home, Players, Devices, More.

## Non-regression rules

- Keep the existing LA PAUSE OS business engine and persistence.
- KPI values come from real sessions, resources, payments/orders/sales and configured products.
- Do not fabricate ONLINE, revenue, stock, session, payment, backup, API or device success.
- No emoji icons in the UI. Use SVG/interface icons.
- No horizontal scrolling on Samsung A07-class portrait widths.
- No `View All` control on this dashboard.
- Real resource/product photos must be used when packaged media exists.
- Quick actions and bottom navigation must remain functional.

This document is additive and records the explicit user-approved replacement for the previously rejected mobile Home presentation. It does not delete the earlier engine or non-regression contracts.
