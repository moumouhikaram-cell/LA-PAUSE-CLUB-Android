# LA PAUSE Device Agent Protocol V1

Status: secure LAN contract for LA PAUSE OS 2.4 Device Control.

## Goal

The operator tablet remains offline-first and authoritative for venue operations. Devices on the local LAN expose a small HTTP agent so LA PAUSE OS can discover, explicitly pair, monitor and command them without Internet.

## Discovery

LA PAUSE OS scans only the tablet's current IPv4 `/24` and probes the supported local agent ports, starting with:

`GET http://<device-ip>:8080/health`

Fallback ports used by the v2.4 scanner are `8765` and `3000`.

An endpoint is accepted only when it explicitly identifies itself as LA PAUSE by at least one of:

- JSON `protocol: "LA_PAUSE_DEVICE_AGENT_V1"`
- JSON `service: "LA_PAUSE_DEVICE_AGENT"`
- HTTP response header `X-LA-PAUSE-Agent` containing `LA_PAUSE`

Discovery never auto-pairs a device. The operator must explicitly associate a discovered agent to a venue resource.

## Health response

Recommended secure response:

```json
{
  "protocol": "LA_PAUSE_DEVICE_AGENT_V1",
  "service": "LA_PAUSE_DEVICE_AGENT",
  "agentId": "tv-ps5-1",
  "name": "TV PS5 1",
  "deviceType": "ANDROID_TV_AGENT",
  "version": "1.0.0",
  "capabilities": {
    "heartbeat": true,
    "display": true,
    "overlay": true,
    "remoteControl": true,
    "power": false,
    "input": false,
    "sessionLease": true
  },
  "supportedCommands": [
    "REFRESH_STATUS",
    "SHOW_MESSAGE",
    "SESSION_START",
    "SESSION_WARNING",
    "SESSION_END",
    "RESTART_AGENT"
  ],
  "authRequired": true,
  "pairingRequired": true,
  "paired": false,
  "overlayPermission": true,
  "overlayVerified": true
}
```

`agentId` must be stable across DHCP/IP changes.

`supportedCommands` is authoritative whenever present. The manager must not expose an optional control that is absent from that list.

## Secure pairing

Authenticated agents advertise `authRequired: true` / `pairingRequired: true`.

The agent displays a short-lived six-digit code locally. The operator enters this code on the LA PAUSE OS tablet after choosing **Associer**.

`POST /v1/pair`

```json
{
  "pairingCode": "483201",
  "managerId": "android-tablet-stable-id",
  "managerName": "LA PAUSE OS"
}
```

Successful response:

```json
{
  "ok": true,
  "protocol": "LA_PAUSE_DEVICE_AGENT_V1",
  "agentId": "tv-ps5-1",
  "token": "one-time-returned-bearer-credential",
  "tokenType": "Bearer",
  "pairedAt": 1788530000000
}
```

Security requirements:

- Pairing code is short-lived and rotates after successful use.
- The Bearer credential is returned only to the pairing caller.
- LA PAUSE OS stores the credential only in Android secure storage (`SecureStore`).
- The credential must never be written to ClubState, local exports, backups, analytics or logs.
- The agent stores only a one-way hash of accepted Bearer credentials.
- The operator may revoke all paired controllers locally from the device agent.

## Commands

`POST /v1/commands`

Header:

`Authorization: Bearer <paired credential>`

Body:

```json
{
  "commandId": "cmd_...",
  "sequence": 12,
  "idempotencyKey": "idem_...",
  "type": "SHOW_MESSAGE",
  "payload": {},
  "issuedAt": 1788530000000
}
```

The agent must treat `idempotencyKey` as exactly-once protection for side effects. A duplicate may return a duplicate ACK, but it must not replay the physical side effect.

### Core command types

- `REFRESH_STATUS`
- `RESTART_AGENT`

### Display / overlay commands

Only when explicitly advertised:

- `SHOW_MESSAGE`
- `SESSION_START`
- `SESSION_WARNING`
- `SESSION_END`

### Other capability-gated optional commands

- `POWER_ON` / `POWER_OFF` require explicit `power: true` and command advertisement.
- `SET_INPUT` requires explicit `input: true` or `hdmi: true` and command advertisement.
- Future volume controls require an explicit audio capability and command advertisement.

The operator UI must never infer optional support from brand, OS family or device class alone.

## Device classes

- `ANDROID_TV_AGENT`: Android/Google TV or compatible Android box agent.
- `WINDOWS_AGENT`: local Windows gaming-PC agent.
- `CONTROLLER_HUB`: microcontroller/edge hub for physical devices.
- `TV`: manually registered TV without an installable agent; monitoring/control may be limited.
- `CUSTOM_DEVICE`: extension point.

## Overlay honesty rule

`overlay: true` is a verified device capability, not an assumption based on the TV brand or Android version. HDMI video paths differ by OEM.

The LA PAUSE Android TV Agent therefore keeps overlay capability OFF until both are true on that exact device:

1. Android granted **Display over other apps** permission.
2. An operator explicitly confirmed that the test banner was visible over the venue's real gameplay/HDMI path.

If the TV/box cannot draw over the external HDMI input, it must keep `overlay: false`; the manager then hides message/session overlay controls for that device.

## Security and scope

- LAN only; no Internet-wide scanning.
- The Android scanner is capped to the tablet's current `/24`.
- Agent servers reject non-local client addresses.
- Only explicit LA PAUSE protocol responses are surfaced.
- Discovery is separate from pairing; operator confirmation is mandatory.
- Authenticated command agents require Bearer credentials.
- Credentials use Android secure storage on the manager.
- Commands are persisted and audited through the existing P2 command bus.
- Idempotency protects physical actions from retry duplication.

## Persistence

Paired device metadata, leases, commands and alerts remain mirrored through the existing P2 state and SQLite dual-write schema (`CoreDeviceSchemaP2`). Secrets are deliberately excluded from that state and are stored separately by the native secure store.
