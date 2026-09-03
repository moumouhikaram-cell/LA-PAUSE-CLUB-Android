# LA PAUSE OS — WEB ↔ ANDROID PARITY CONTRACT V1

Source of truth: Web CDC + Android edge-first/offline requirements.

## 1. Principle
Android is not a parallel product. It is an offline-capable client/authority surface of the same LA PAUSE OS domain model used by Web/Edge.

- No full-state replacement sync.
- No last-file-wins.
- Commands describe requested mutations.
- DomainEvents describe accepted/applied facts.
- Entity revisions + tombstones + cursor drive reconciliation.
- At-least-once delivery + idempotency, never “exactly once”.
- Finance uses integer minor units.
- Cloud/Web outage must not stop a provisioned venue.

## 2. Identity scope
Every sync-relevant record carries as applicable:
- tenantId
- venueId
- branchId
- deviceId
- entityId
- revision
- updatedAt

Device identity is stable; MAC/IP are hints only.

## 3. CommandEnvelope
```json
{
  "schemaVersion": 1,
  "commandId": "cmd-uuid",
  "idempotencyKey": "stable-key",
  "commandType": "SESSION.START",
  "entityType": "session",
  "entityId": "sess-uuid",
  "tenantId": "tenant-id",
  "venueId": "venue-id",
  "branchId": "branch-id",
  "deviceId": "android-device-id",
  "actorId": "staff-or-owner-id",
  "baseRevision": 12,
  "issuedAt": 1760000000000,
  "payload": {}
}
```

Rules:
- commandId unique.
- idempotencyKey stable across retries.
- baseRevision is mandatory for update/delete commands when known.
- command validation is strict; malformed/unknown commands are rejected, never silently accepted.

## 4. DomainEventEnvelope
```json
{
  "schemaVersion": 1,
  "eventId": "evt-uuid",
  "eventType": "session.started",
  "entityType": "session",
  "entityId": "sess-uuid",
  "tenantId": "tenant-id",
  "venueId": "venue-id",
  "branchId": "branch-id",
  "deviceId": "android-device-id",
  "actorId": "staff-or-owner-id",
  "revision": 13,
  "occurredAt": 1760000000000,
  "payload": {}
}
```

## 5. SyncRequest `/v1/sync`
```json
{
  "protocolVersion": "la-pause-sync/1",
  "schemaVersion": 1,
  "tenantId": "tenant-id",
  "venueId": "venue-id",
  "branchId": "branch-id",
  "deviceId": "android-device-id",
  "cursor": "opaque-server-cursor",
  "clientRevision": 201,
  "clientTime": 1760000000000,
  "authorityState": "TABLET_PRIMARY",
  "commands": [],
  "events": [],
  "tombstones": []
}
```

## 6. SyncResponse
```json
{
  "protocolVersion": "la-pause-sync/1",
  "serverTime": 1760000001000,
  "cursor": "next-cursor",
  "acceptedCommands": [],
  "rejectedCommands": [],
  "acceptedEvents": [],
  "rejectedEvents": [],
  "changes": [],
  "tombstones": [],
  "conflicts": [],
  "authorityLease": {},
  "entitlement": {}
}
```

## 7. Canonical state machines
### Queue
WAITING → CALLED → SEATED
WAITING/CALLED → LEFT
Each transition carries timestamp and actor/device.

### Session
ACTIVE ↔ PAUSED → COMPLETED
ACTIVE/PAUSED → CANCELLED only through a validated command.
Amounts and payment state are derived from ledgers, not free-form UI state.

### Readiness
READY / DEGRADED / BLOCKED
Reasons are structured evidence, not a free text verdict.

### Device health
ONLINE / DEGRADED / OFFLINE
Heartbeat + lastSeen + version + capabilities + endpoint diagnostics.

## 8. Finance parity
Web and Android use the same concepts:
- Payment ledger
- Refund ledger
- Credit notes / exchanges
- Cash movements
- Shift open/close
- Stock movements
- Atomic sale/payment/stock/cash/audit/outbox transaction
- No expense counted as revenue
- No silent post-close mutation

All money is integer minor units in normalized persistence and sync payloads.

## 9. Consent parity
Profile edits never recreate consent.
ConsentEvidence is a separate immutable evidence record with:
- consentId
- customerId
- scope/type
- textVersion
- granted/revoked
- actor/device
- timestamp
- evidenceHash/HMAC when server-supported

## 10. Audit parity
Append-only audit chain fields:
- auditId
- previousHash
- hash
- actorId
- deviceId
- action
- targetType/targetId
- before/after/diff
- serverTimestamp when online
- localTimestamp when offline

Android must preserve local chain and later reconcile with server sealing; it never claims server-sealed integrity while offline.

## 11. Tombstones
Deletion is synchronized as a tombstone, never as “record absent”.
Fields:
- entityType
- entityId
- revision
- deletedAt
- deviceId
- reason if applicable

## 12. Conflict policy
Never last-write-wins globally.
- Higher server-accepted revision wins after command validation.
- Stale local command is rejected with conflict metadata.
- Financial conflicts are never auto-merged.
- Venue/profile metadata may use deterministic field-level reconciliation only when explicitly allowed.
- Conflicts are persisted until resolved.

## 13. Authority / failover
CONNECTED_LOCAL:
EDGE_PC_PRIMARY → lease expiry → TABLET_EMERGENCY_PRIMARY → replay/reconcile → controlled EDGE_PC_PRIMARY recovery.

STANDALONE:
TABLET_PRIMARY and no network requirement.

## 14. CDC parity domains
Android and Web share canonical IDs/contracts for:
Venue, Resource, RatePlan, Session, Payment, Refund, CreditNote, Shift, CashMovement, Customer, ConsentEvidence, LoyaltyEntry, Pass, Membership, Voucher, Product, StockMovement, PurchaseOrder, GoodsReceipt, Booking, QueueEntry, Device, SessionLease, Asset, Maintenance, AuditEvent, SuspiciousActivityEvent, Task, Recommendation, Forecast, PlayerProfile, Mission, Rating, Tournament, Campaign, ProofOfPlay, Entitlement, AutomationRule, AiDraft, GamingPassport.

## 15. External dependency rule
Capabilities needing Web/Cloud/TV/third-party infrastructure are represented in Android with complete local contracts, status and degraded behavior, but stay BLOCKED_EXTERNAL until the counterpart exists. Android must never show CONNECTED or EXECUTED based only on configuration.
