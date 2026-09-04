# LA PAUSE OS — SaaS Platform Blueprint V1

Status: CANONICAL PRODUCT DIRECTION
Date: 2026-09-04

## 1. Product definition

LA PAUSE OS is not a PS5 manager and not an Android-only venue app.
It is a multi-tenant SaaS operating platform for modern gaming and leisure venues.

Android is the first operational client. The final platform must support the same business model and domain contract through:
- Android operator app
- Web owner/admin app
- Desktop/Edge app
- iOS/iPadOS operator/owner app
- Player/member web/mobile experience
- Device agents (Android TV, Windows, controller hubs)

No new critical business rule may exist only in an Android screen or only in JavaScript UI code.

## 2. Scalable hierarchy

PLATFORM
  -> ACCOUNT (human identity)
      -> TENANT / ORGANIZATION
          -> VENUE / BRAND
              -> BRANCH / PHYSICAL LOCATION
                  -> BUSINESS MODULES
                  -> RESOURCE GROUPS / METIERS
                      -> RESOURCES
                          -> DEVICES
                          -> SESSIONS

Simple venue: 1 tenant + 1 venue + 1 branch.
Franchise/group: 1 tenant + multiple venues/branches.
A user account can belong to multiple tenants with different roles.

Every business row that can sync MUST eventually be scoped by tenant_id + venue_id + branch_id where applicable.
No permanent LOCAL_VENUE_ID assumption may remain in authoritative SaaS data.

## 3. Identity model

Separate authentication identity from CRM identity.

### SaaS account
Global authenticated identity used by owners/staff/players.
- accountId
- email / phone
- MFA state
- security sessions
- trusted devices

### Tenant membership
Links an account to an organization.
- tenantId
- accountId
- roleId
- status
- venue/branch scopes

### Player/member profile
Optional member identity for players.
- accountId optional
- customerId / membershipId
- loyalty balance
- passes
- reservations
- tournament identity
- consent

### Guest / walk-in
A session can remain explicitly NON_IDENTIFIED.
Never create a fake selected “Client passage” record.

## 4. Authorization model

Permissions are authoritative. Roles are templates of permissions.

Platform roles:
- PLATFORM_ADMIN

Tenant roles:
- OWNER
- TENANT_ADMIN
- VENUE_MANAGER
- CASHIER
- FLOOR_STAFF
- ACCOUNTANT
- MARKETING
- TECHNICIAN
- VIEWER

Customer roles:
- PLAYER_MEMBER
- GUEST

Examples of permissions:
- session.read / session.start / session.finish / session.override
- payment.read / payment.capture / payment.refund
- cash.open / cash.close / cash.adjust
- accounting.read / accounting.export
- customer.read / customer.write / customer.marketing
- campaign.read / campaign.send
- inventory.read / inventory.adjust
- pricing.read / pricing.write
- device.read / device.control / device.pair
- staff.manage
- tenant.billing.manage
- module.manage

Security/RBAC basics are never a paid security option. Advanced workflow/approval controls may be premium.

## 5. SaaS module architecture

The application is one codebase. Commercial access is controlled by signed entitlements.
Bundles are pricing conveniences only; they are not separate apps.

### PLATFORM CORE — mandatory — 99 MAD / tenant / month
Includes:
- account + tenant identity
- one venue / one branch
- core security
- offline local store
- secure sync engine
- backups/recovery contract
- base roles and permissions
- 2 staff accounts
- module marketplace / entitlement runtime
- basic activity audit

### M01 OPERATIONS / GESTION — 149 MAD / venue / month
Standalone business module.
- resources and métiers
- sessions
- per-game / per-time / block / fixed / custom billing models
- pricing rules
- queue
- operational dashboard
- reservations created by staff
- dynamic resource/game media

### M02 POS / CAISSE — 89 MAD / venue / month
Can operate with or without Operations.
- cash register
- payments
- payment methods
- opening/closing shifts
- receipts
- refunds with permission
- cash movements

### M03 INVENTORY / SNACKS — 49 MAD / venue / month
Can operate standalone; integrates with POS when both are enabled.
- products
- stock
- cost/price
- thresholds
- purchases/basic suppliers
- session-attached snack sales when Operations is enabled

### M04 FINANCE / COMPTA — 99 MAD / venue / month
- revenue ledger
- expense ledger
- VAT/tax configuration layer
- daily/monthly close
- P&L oriented reports
- exports
- reconciliation
- accounting audit trail
May consume POS and Operations data, but must still accept manual entries when those modules are absent.

### M05 CRM / LOYALTY — 79 MAD / venue / month
- customer profiles
- membership
- loyalty points
- passes/wallets
- churn/return intelligence
- consent history
- segmentation basics

### M06 MARKETING / GROWTH — 99 MAD / venue / month
Requires CRM data capability.
- campaigns
- offers
- promo codes
- birthday/return offers
- segmentation
- conversion attribution
- assisted revenue
- cross-sell suggestions
External SMS/WhatsApp/email provider fees are not included.

### M07 BOOKINGS / QUEUE PRO — 59 MAD / venue / month
- self-service booking
- deposits
- capacity rules
- waitlist
- booking portal/API
- no-show policies

### M08 TOURNAMENTS / COMMUNITY — 59 MAD / venue / month
- registrations
- brackets
- qualification
- results/winners
- leaderboards
- player profiles/teams
- challenge campaigns

### M09 DEVICE CONTROL — 99 MAD / venue / month
Includes first 10 managed devices.
Then +9 MAD / managed device / month.
- Android TV agents
- Windows agents
- controller hubs
- device health
- pairing
- commands
- lifecycle orchestration
- alerts
- remote operations

### M10 OWNER ANALYTICS / BI — 79 MAD / tenant / month
- owner cockpit
- cross-module KPIs
- occupancy
- margin
- staff performance
- game/resource performance
- forecasts
- exports

### M11 PLAYER / MEMBER PORTAL — 79 MAD / tenant / month
- player account
- balance/pass
- booking
- history
- loyalty
- notifications
- tournaments
- profile
- optional cross-venue gaming passport with consent

### M12 ADVANCED TEAM / APPROVALS — 49 MAD / tenant / month
- custom roles
- approval workflows
- sensitive-action dual approval
- branch-specific role scopes
- staff session/device policy

### M13 MULTI-SITE — 149 MAD / additional branch / month
- branch switcher
- consolidated owner view
- branch-scoped permissions
- central pricing templates
- central campaign templates
- cross-branch reporting

### M14 API / INTEGRATIONS — 99 MAD / tenant / month
- public API credentials
- webhooks
- accounting integrations
- payment gateways
- CRM/marketing adapters
- external BI/export automation
Provider fees excluded.

### M15 AI OPERATOR — 149 MAD / tenant / month + model usage
- AI drafts
- operational recommendations
- campaign drafts
- anomaly explanations
- owner questions
No autonomous destructive/financial action without explicit policy/approval.

## 6. Launch bundles

All modules remain individually purchasable where dependencies permit.

ESSENTIAL — 219 MAD/month
- Platform Core
- Operations

BUSINESS — 399 MAD/month
- Platform Core
- Operations
- POS
- Inventory
- CRM
- Bookings Pro

PRO — 599 MAD/month
- Business bundle
- Finance
- Marketing
- Tournaments
- Owner Analytics
- Player Portal

AUTOMATION — 749 MAD/month
- Pro bundle
- Device Control up to 10 devices
- Advanced Team
- API/Integrations

Enterprise / franchise: custom, with volume pricing and SLA.

These are launch prices in MAD and must live in a versioned server-side catalog, never hard-coded into business screens.

Competitive reference: established gaming-center systems commonly price by managed device; Smartlaunch publicly lists approximately USD 7/device/month for its base management tier, while SENET uses plan + device tiers. LA PAUSE OS deliberately combines modular venue pricing with device metering only where the cost/value is device-specific.

## 7. Entitlement contract

Every paid capability is controlled by a server-issued signed entitlement.

Canonical fields:
- entitlementId
- catalogVersion
- tenantId
- venueIds / branchIds
- modules[]
- features[]
- limits{}
- issuedAt
- periodStart
- periodEnd
- offlineValidUntil
- deviceBindings[] optional
- status
- keyId
- signature

Suggested signature: ECDSA P-256 for broad Android/Web/Desktop/iOS/WebCrypto support.

Client API:
- hasModule(moduleId)
- hasFeature(featureId)
- limit(limitId)
- can(permission, scope)
- moduleState(moduleId)

UI hiding is not security. Server/API and local command authority must also enforce entitlements.

Offline-first licensing:
- signed entitlement is cached locally
- monthly subscription remains usable offline until period end + controlled grace
- offline venues can import a renewed signed entitlement by QR/file from the owner portal without giving the venue permanent Internet
- core recovery/read access must never destroy customer data because a subscription expired
- premium writes can enter restricted/read-only mode after license expiry according to policy

## 8. Cross-platform client architecture

Canonical architecture:

DOMAIN CONTRACTS
  -> AUTH / TENANCY / ENTITLEMENTS
  -> COMMAND + EVENT PROTOCOL
  -> SYNC / CONFLICT / TOMBSTONE CONTRACT
  -> API
      -> Android client
      -> Web client
      -> Desktop/Edge client
      -> iOS/iPadOS client
      -> Player client

Existing `la-pause-sync/1` is the seed, not the final Android-only protocol.
It must evolve to a platform-neutral LA PAUSE CLIENT PROTOCOL.

Every command/event must carry:
- tenantId
- venueId
- branchId
- actorId
- originDeviceId
- entityType/entityId
- baseRevision
- idempotencyKey
- correlationId
- timestamp
- payload schema version

Server is authoritative for:
- authentication
- tenant membership
- paid entitlements
- billing catalog
- cross-device conflict resolution policy
- global user identity
- cloud audit

Local clients remain authoritative only under explicit offline/edge authority leases for allowed domains.

## 9. Platform Bridge

Business code must not call Android APIs directly.
Create a shared PlatformBridge interface:
- secureStore.get/set/delete
- http.request
- localStore.transaction
- notifications.schedule/push
- device.identity
- integrity.attest
- files.import/export
- camera/QR
- network.localDiscovery
- backgroundTasks
- biometrics optional

Implementations:
- AndroidBridge
- WebBridge
- DesktopBridge
- IOSBridge

Device Control remains an adapter/domain, not an Android-only assumption.

## 10. Security architecture — mandatory, not a paid module

No mobile app can be mathematically “unhackable”. Goal: modification is difficult, detectable, revocable, and commercially useless.

### Build/application integrity
- permanent release signing key
- runtime signing-certificate validation
- package/applicationId validation
- R8 minification/obfuscation in release
- resource shrinking where safe
- non-debuggable release
- anti-repackaging checks
- signed asset integrity manifest
- CI verifies signer/certificate/hash

### Data at rest
- Android Keystore / iOS Keychain/Secure Enclave equivalents
- no auth/device/license secrets in sync state JSON
- encrypted local sensitive database or sensitive fields
- encrypted exports for sensitive backups
- `allowBackup=false` for production unless encrypted backup design explicitly allows it

### WebView/client shell
- replace broad file:// WebView trust with controlled app asset origin
- strict navigation allowlist
- never expose native JS bridge to arbitrary remote pages
- CSP for shared web UI
- no inline remote executable code

### Network
- TLS for cloud API
- certificate pinning strategy / rotation support
- short-lived access tokens + refresh token protection
- backend rate limiting
- authenticated device registration
- LAN device protocol must migrate from open cleartext transport to an authenticated encrypted channel before commercial release

### SaaS/license security
- signed entitlements
- tenant/venue scope validated server-side
- device binding where needed
- revocation list
- offline expiry/grace
- modified UI cannot create server-authorized premium actions

### Identity/security
- MFA for owner/admin
- optional biometric unlock on trusted operator devices
- session revocation
- device session list
- password/credential policy handled by auth backend
- least privilege RBAC
- sensitive actions require re-auth/approval policy

### Audit
- immutable-ish append-only audit events
- actor/device/tenant/venue/correlation IDs
- refund/discount/price/role/module/device changes audited
- security events audited

### Platform integrity signals
Android: Play Integrity where distribution permits + local signer checks.
iOS: App Attest / DeviceCheck.
Desktop: signed binaries + updater signature verification.
Web: server-side auth, CSP, secure cookies/tokens, origin protections.
These are risk signals and defense layers, never the sole authorization mechanism.

## 11. Critical current gaps identified in Android code

Must be fixed before SaaS commercial release:
- release minification currently disabled
- Android backup currently enabled
- cleartext traffic currently globally allowed
- native JavaScript bridge currently lives in a WebView model that needs strict origin/navigation confinement
- several business tables are not fully tenant/venue/branch scoped
- normalized venue schema still carries a single local venue assumption
- entitlement `features` exist but do not yet centrally gate all modules/actions
- authentication/account creation is not yet a complete SaaS identity system
- current UI still contains legacy single-venue/console assumptions

## 12. Migration rule

Do not rewrite the proven session/offline/device engines from scratch.
Refactor around contracts:
1. isolate domain logic from UI
2. introduce tenant scope everywhere
3. introduce central entitlement runtime
4. introduce permission runtime
5. introduce PlatformBridge
6. move shared schemas/contracts into platform-neutral files
7. rebuild the complete UI shell
8. connect cloud identity/billing/sync
9. add Web/Desktop clients against the same contracts
10. add iOS client against the same contracts

## 13. QA gates required

A release cannot be called SaaS-ready unless automated tests prove:
- tenant A cannot read/write tenant B
- branch scoping is enforced
- role permissions are enforced
- disabled module cannot execute even if UI is bypassed
- forged/expired entitlement is rejected
- offline entitlement behaves per policy
- modified signer/build is detected where runtime checks apply
- secrets do not enter exported state
- sync is idempotent across Android/Web/Desktop/iOS contract fixtures
- concurrent edits generate deterministic conflict handling
- player account and venue CRM record are distinct but linkable with consent
- Android offline operation remains functional
- full legacy business regression remains green
