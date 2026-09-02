# LA PAUSE CLUB Manager Sync Contract v1

L'app Android est conçue pour rester opérationnelle sans serveur. Chaque mutation locale crée un événement dans `outbox`.

## Endpoint principal

`POST /v1/sync`

### Requête

```json
{
  "schemaVersion": 4,
  "branchId": "elhajeb-main",
  "deviceId": "android_xxx",
  "cursor": null,
  "events": [],
  "clientRevision": 42,
  "clientTime": "2026-08-29T14:00:00.000Z"
}
```

### Réponse

```json
{
  "ackEventIds": ["evt_..."],
  "cursor": "server-cursor-43",
  "changes": [
    {
      "entityType": "session",
      "entity": {"id":"sess_...","revision":2,"updatedAt":1788012000000}
    }
  ]
}
```

## Entités gérées

- `station`
- `session`
- `payment`
- `client`
- `reservation`
- `shift`
- `cash`

## WebSocket

Le client peut ouvrir l'URL configurée puis envoyer :

```json
{"type":"hello","branchId":"elhajeb-main","deviceId":"android_xxx","token":"..."}
```

Le serveur peut pousser :

```json
{"type":"changes","changes":[]}
```

## Conflits

Le client accepte une version distante si sa `revision` est supérieure ou égale à la version locale, ou si `updatedAt` est plus récent. Le backend final pourra renforcer cette politique avec une séquence serveur transactionnelle.

## Principe de migration du Web

Le Web et Android doivent partager les IDs de postes, sessions, paiements et clients. Il ne faut pas créer une seconde base Android indépendante une fois le backend disponible : le serveur devient la source commune et l'Android conserve un cache/offline outbox.

## v1.2A unified entities
Station payloads may now carry `mediaUrl`, `defaultMedia`, `locked`, and `tv { ip, name, connected, overlayEnabled }`.
Session payloads may now carry `gameCategory`, `gameTitle`, and `coverUrl` so desktop and Android render the same dynamic visual and selected game.
Additional entity types prepared for sync: `queue`, `order`, `product`, `incident`, `equipment`, `inventory`, `maintenance`, `purchase`, `team`, `journal`, `folder`.
