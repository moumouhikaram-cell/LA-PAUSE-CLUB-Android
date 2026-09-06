# LA PAUSE CLUB — Classic Restore Module Inventory

## Restoration contract

- Active visual/runtime baseline: **historical v1.3.1 package** (`LA_PAUSE_CLUB_Android_GitHubReady_v1.3.1.b64.txt`).
- Historical package SHA-256 after decode: `ea0efa23e38e224596e6d57623f57d0712b1b8739fc73fe638c5a616071f6f0e`.
- SaaS: **PARKED / NOT LOADED**.
- Onboarding: **PARKED / NOT LOADED**.
- New-app shell: **PARKED / NOT LOADED**.
- Existing later modules stay in this branch/repository and must not be deleted or rewritten. They are reintroduced only one module at a time after explicit approval.

## Modules already present in the classic product

### Exploitation
- Gaming Floor / Salle
- Sessions
- Reservations & planning
- Queue / file d'attente
- Session history
- Incidents

### Commerce
- Express cash register / caisse
- Orders
- Products / snacks / drinks
- Clients / CRM
- Pricing
- Offers & gifts
- Campaigns

### Community
- Tournaments
- Challenges
- Leaderboards
- PS5 Hall

### Fleet & technical
- TVs & stations
- Equipment fleet
- Inventory
- Maintenance
- Purchases

### Management
- Overview
- Revenue
- Occupancy
- Closure

### Administration
- Settings
- Team
- Journal
- Folders

## Later business modules preserved but parked

### Operator-first / v230+
- Operator Control Center
- Contextual billing by resource type
- Billiards per-game journey
- PS5 Duo 30-minute fast journey
- Next Best Action
- Conversion opportunities
- +30 minutes action
- +1 game action
- Snack upsell action
- Assisted revenue / CA assisté
- acceptedActions audit trail
- Session payment guard
- Operator actions and operator UX layers

### Device control / v240+
- TV / station device control
- Device fleet state
- Client/device domain bridge
- Home device pulse
- TV overlay/control groundwork

### Offline / sync / platform
- Standalone-first offline operation
- Sync runtime / protocol
- Entitlement offline handling
- Tenant isolation
- Workspace support
- Provisioning / entitlement layers

### Intelligence / owner / player
- Owner views
- Intelligence layer
- Player experience layer
- Commerce/finance/ops modular layers

### SaaS / new-app work — PARKED
- SaaS workspaces
- RBAC / entitlement SaaS
- SaaS shell
- Account creation flow
- Business onboarding
- Commercial setup
- Floor-plan onboarding
- Trial activation
- New app / Control Center shell

## Reintroduction rule

1. Classic UI remains the visual source of truth.
2. A parked module is never allowed to replace the classic shell globally.
3. Reintroduce one approved module at a time.
4. Reuse existing code/business logic whenever possible; do not redevelop an already existing module from scratch.
5. Each reintroduced module must pass targeted Android physical interaction QA before the next module is added.
