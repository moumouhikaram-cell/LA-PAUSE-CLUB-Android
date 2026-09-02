# A1 Implementation Notes

## Implemented

- Side-by-side alpha package `com.lapauseclub.manager.a1`.
- First-run choice between standalone and local-connected intent.
- Standalone local venue initialization.
- Stable Android device identity.
- Explicit operating-mode and authority enums.
- Generic resources: consoles, billiards, snooker, sim racing, PC gaming, table tennis, private rooms, custom.
- Capability model independent from resource type.
- SQLite WAL + foreign keys.
- One active session per resource invariant.
- Billing in integer minor currency units.
- Configurable billing increment and minimum billed minutes.
- Timer integrity: elapsed realtime on same boot, wall-clock fallback after reboot.
- Transactional session stop + payment + resource release + domain events.
- Durable outbox events for later sync.
- Local dashboard derived from persisted records.
- Verified JSON backups with SHA-256 checksum and 7-version rotation.
- Sync coordinator explicitly non-required for local operation.
- Local-only WebView navigation guard.
- Dedicated GitHub Actions A1 build workflow.

## Deliberately not implemented yet

Desktop discovery/pairing, real LAN sync, Emergency Primary takeover, reconciliation UI, Cloud sync, full v1.5 POS/stock/client parity, v1.5 data migration, Android Keystore auth, staff roles and push notifications.

Those features are not simulated as working.

## Safety choice

A1 uses a separate applicationId so it can be installed next to v1.5 while the new core is tested. Do not replace the production package until parity and migration are validated.
