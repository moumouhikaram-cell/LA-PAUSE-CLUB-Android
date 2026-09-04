# LA PAUSE Device Agent Protocol V1

Status: contract for LA PAUSE OS 2.4 Device Control.

## Goal

The operator tablet remains offline-first and authoritative for venue operations. Devices on the local LAN may expose a small HTTP agent so LA PAUSE OS can discover, associate, monitor and command them without requiring Internet access.

## Discovery

LA PAUSE OS scans only the tablet's current IPv4 /24 and probes the fixed discovery endpoint:

`GET http://<device-ip>:8080/health`

An endpoint is accepted only when it explicitly identifies itself as LA PAUSE by at least one of:

- JSON `protocol: "LA_PAUSE_DEVICE_AGENT_V1"`
- JSON `service: "LA_PAUSE_DEVICE_AGENT"`
- HTTP response header `X-LA-PAUSE-Agent` containing `LA_PAUSE`

Discovery never auto-pairs a device. The operator must explicitly associate a discovered agent to a venue resource.

## Health response

Recommended response:

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
  }
}
```

`agentId` must be stable across DHCP/IP changes.

## Commands

`POST /v1/commands`

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

The agent must treat `idempotencyKey` as exactly-once protection for side effects and should reject stale command sequences when appropriate.

### Core command types

- `REFRESH_STATUS`
- `SHOW_MESSAGE`
- `SESSION_WARNING`
- `SESSION_END`
- `RESTART_AGENT`

### Capability-gated optional commands

- `POWER_ON` / `POWER_OFF` require `power: true`
- `SET_INPUT` requires `input: true` or `hdmi: true`
- future volume commands require an explicit audio capability

The operator UI must never expose an optional control that the agent has not advertised.

## Device classes

- `ANDROID_TV_AGENT`: Android/Google TV or compatible Android box agent.
- `WINDOWS_AGENT`: local Windows gaming-PC agent.
- `CONTROLLER_HUB`: microcontroller/edge hub for physical devices.
- `TV`: manually registered TV without an installable agent; monitoring/control may be limited.
- `CUSTOM_DEVICE`: extension point.

## Overlay honesty rule

`overlay: true` is a verified device capability, not an assumption based on the TV brand or Android version. HDMI video paths differ by OEM. An agent must advertise overlay support only after it can actually draw the LA PAUSE message over the venue's real gameplay/input path.

## Security and scope

- LAN only; no Internet-wide scanning.
- The Android scanner is capped to the tablet's current /24.
- Only explicit LA PAUSE protocol responses are surfaced.
- Discovery is separate from pairing; operator confirmation is mandatory.
- Credentials/tokens must use Android secure storage when authenticated pairing is added.
- Commands are persisted and audited through the existing P2 command bus.

## Persistence

Paired devices, leases, commands and alerts remain mirrored through the existing P2 state and SQLite dual-write schema (`CoreDeviceSchemaP2`).
