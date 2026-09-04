# LA PAUSE OS 2.5 — Cross-platform architecture

## Product rule
LA PAUSE OS is one SaaS product with multiple clients:
- Android operator app
- Web app
- Desktop app
- iPhone/iPad app
- device agents (Android TV, Windows, future adapters)

Android is a platform adapter, not the product core.

## Shared product layers

### 1. Domain Core
Platform-neutral business logic and schemas:
- tenants
- venues
- activities
- resources
- rate plans
- sessions
- tickets
- payments
- products/orders
- customers
- reservations/queue
- competitions
- devices
- accounting
- entitlements
- audit/events

No Android API, DOM API, filesystem API or desktop-only API may live in the domain contract.

### 2. Event / Sync Contract
All clients speak the same protocol:
- stable IDs
- entity revision
- createdAt / updatedAt
- tenantId / venueId
- idempotency keys
- append-only domain events where needed
- local outbox
- server cursor
- conflict resolution
- authority lease for offline/edge scenarios

Canonical envelope:
```json
{
  "protocolVersion":"la-pause-sync/1",
  "schemaVersion":1,
  "eventId":"evt-...",
  "eventType":"SESSION.STARTED",
  "tenantId":"tenant-...",
  "venueId":"venue-...",
  "deviceId":"device-...",
  "entityType":"SESSION",
  "entityId":"sess-...",
  "revision":7,
  "idempotencyKey":"...",
  "clientTime":0,
  "payload":{}
}
```

### 3. SaaS Entitlements
Entitlements are server-issued and platform-independent.
Android, Web, Desktop and Apple clients consume the same module IDs.

No platform is allowed to invent premium access locally in production.

### 4. UI Product Shell
The SaaS information architecture is shared:
- Today
- Operations
- Sales
- Customers
- Planning
- Insights
- System

Responsive presentation differs by platform, but route semantics and permissions remain identical.

### 5. Platform Bridge
The UI/core calls a single abstract bridge.

Contract examples:
- secureGet / secureSet / secureDelete
- http
- notify
- vibrate / haptic
- keepAwake
- saveFile / openFile
- qr
- deviceInfo
- integrityStatus
- localDiscovery
- appLifecycle

Platform implementations:
- AndroidBridge
- WebBridge
- DesktopBridge
- AppleBridge

No new SaaS UI code may call `Android.*`, `window.ClientAndroid`, native Android methods or desktop globals directly.

## Platform mapping

### Android
- WebView/native hybrid currently
- Android Keystore for secrets
- signed APK identity
- future Play Integrity where distribution permits
- LAN discovery for device agents

### Web
- secure HTTPS only
- server session / access tokens
- browser storage contains no long-lived privileged secret when avoidable
- WebAuthn/passkeys supported later
- no LAN/device-control assumptions unless browser capabilities explicitly allow them

### Desktop
- signed desktop package
- OS keychain/credential vault
- local agent/network orchestration
- can become edge authority when configured
- same sync and entitlement contracts

### Apple iOS/iPadOS
- WKWebView/native shell or equivalent shared UI packaging
- Keychain for secrets
- App Attest / DeviceCheck integration path
- APNs notifications
- platform-specific LAN permission model
- no Android-only API dependency in shared product code

## Security / anti-tamper model
No client can be made literally impossible to modify. The goal is defense-in-depth and server trust.

### Common trust rules
- premium entitlement is server signed / server validated
- server never trusts locally edited module state
- sensitive mutations require authenticated actor + tenant + venue authorization
- audit events include actor/device/platform
- replay protection through idempotency keys and nonce/session rules
- module unlock evaluated server-side for cloud actions

### Android trust
- permanent signing certificate check
- R8/minification/resource shrinking
- secure secrets in Keystore
- backups restricted
- cleartext limited to explicit private-LAN agent paths
- WebView hardened
- debug builds visibly non-production and cannot obtain production entitlements

### Apple trust
- App Store signing identity
- App Attest/DeviceCheck where appropriate
- Keychain
- production entitlement validation by server

### Desktop trust
- signed binaries
- update signature verification
- OS secure credential store
- device registration / revocation

### Web trust
- HTTPS/HSTS
- secure cookies/token rotation
- CSP / origin restrictions
- server authorization on every privileged operation

## Multi-client concurrency
One tenant may have:
- owner on web
- manager on desktop
- staff on Android tablets
- owner on iPhone
- TV/Windows agents attached to resources

Rules:
- every mutation has actorId + deviceId
- optimistic revisions prevent silent overwrite
- idempotency prevents duplicate payment/session commands
- conflict objects are explicit
- authority lease determines which edge client may perform protected offline mutations when connected architecture requires it
- local offline work remains possible inside granted entitlement grace and local authority rules

## Data ownership / sync scope
Every synced business entity carries tenant and venue scope where applicable.

Tenant-level:
- subscription
- module catalog assignment
- organization users/roles
- multi-venue dashboards
- centralized policies

Venue-level:
- resources
- sessions
- tickets
- cash
- products/stock
- customers when venue-scoped
- reservations
- devices
- local configuration

Cross-venue customer identity must be an explicit tenant policy, not assumed.

## API boundaries
Recommended service families:
- `/v1/auth/*`
- `/v1/handshake`
- `/v1/sync`
- `/v1/entitlements`
- `/v1/tenants`
- `/v1/venues`
- `/v1/users`
- `/v1/reports`
- `/v1/modules`
- `/v1/devices/*`

Business clients should prefer sync/domain commands rather than platform-specific endpoints.

## Release strategy
- shared schema version is independent from Android version
- each client advertises appVersion + protocolVersion + schemaVersion + platform
- server can reject incompatible protocol/schema while still allowing safe offline core
- feature flags never replace entitlement checks

## Immediate v2.5 implementation requirements
1. Introduce shared PlatformBridge.
2. Route SaaS UI through PlatformBridge only.
3. Keep P5 sync contract as the starting point and remove platform assumptions around it.
4. Convert entitlement state into a signed/verified production contract.
5. Add platform + device metadata to sync handshake.
6. Add tests proving the same module/topology decisions for Android/Web/Desktop/iOS bridge mocks.
7. Do not design any new screen that cannot map cleanly to web/tablet/phone/desktop layouts.
