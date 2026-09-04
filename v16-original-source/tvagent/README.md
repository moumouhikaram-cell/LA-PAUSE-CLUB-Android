# LA PAUSE TV Agent 1.0

Companion Android TV / Android box for LA PAUSE OS 2.4 Device Control.

## Role

The manager tablet remains the venue authority. This APK runs on a controllable Android TV/box and exposes the local `LA_PAUSE_DEVICE_AGENT_V1` protocol on the venue LAN only.

- `GET /health` — identity, capabilities and supported commands.
- `POST /v1/pair` — one-time 6-digit pairing code -> Bearer credential.
- `POST /v1/commands` — authenticated, idempotent command execution.
- Ports tried in order: 8080, 8765, 3000.
- No Internet or cloud is required.

## First installation

1. Install the TV Agent APK on the Android TV/box.
2. Open **LA PAUSE TV Agent** and give the device a venue name, e.g. `TV PS5 1`.
3. Keep the agent and the LA PAUSE OS tablet on the same LAN/Wi-Fi.
4. On the tablet: **Devices -> Scanner le Wi-Fi -> Associer**.
5. Enter the six-digit code shown on the TV Agent.
6. The manager stores the resulting Bearer credential only in Android secure storage; it is never exported in ClubState.

## Overlay validation — mandatory honesty rule

`overlay=true` is OFF by default.

To enable it for a specific TV/box:

1. Grant Android **Display over other apps** permission.
2. Put the venue TV on the actual gameplay/HDMI path used with the console.
3. Press **Afficher un test overlay** in the TV Agent.
4. Only if the LA PAUSE banner is genuinely visible over that real gameplay path, tick **J'ai vérifié l'overlay sur le gameplay HDMI réel**.

If the box/TV architecture cannot draw over the external HDMI input, leave the checkbox off. The manager will then not expose message/session overlay commands for that device.

## Security

- LAN clients only.
- Pairing code expires after 10 minutes and rotates after use.
- Command endpoint requires Bearer authentication.
- The agent stores only SHA-256 hashes of authorized controller tokens.
- Idempotency keys prevent repeated side effects.
- Optional controls are advertised only when the device has actually validated the capability.
