# LA PAUSE OS — CDC ANDROID / TABLET
Version de travail: 2026-09-03
Cible de départ: APK existante `com.lapauseclub.manager`, branche source `android-v16-original-integration`, base v1.6.0.
Source produit canonique: `CODEX_LA_PAUSE_OS_MASTER_EXECUTION_PLAN_V2_AUDITED.md` (3420 lignes minimum).

## 0. Mission
Transformer l'APK actuelle en surface Android/Tablet officielle de LA PAUSE OS, sans recréer une application et sans supprimer les fonctions déjà présentes.

L'APK doit être utilisable selon deux modes en un clin d'oeil:
- **AUTONOME**: la tablette est l'autorité locale, Internet et PC non requis.
- **SYNCHRONISÉ**: la tablette se paire à LA PAUSE Desktop/Web/Edge et partage le même contrat métier, les mêmes événements et les mêmes données.

Principe absolu: une perte Internet, Cloud, Wi-Fi ou Desktop ne doit jamais empêcher les opérations locales essentielles d'une salle déjà provisionnée.

## 1. Règles absolues Android
1. Conserver le package `com.lapauseclub.manager`.
2. Préserver toutes les données v1.5/v1.6; aucune migration destructive.
3. Ne jamais afficher un faux succès de synchronisation.
4. Ne jamais dépendre d'une IP/MAC comme identité primaire.
5. Les tarifs officiels restent 22 MAD/h solo, 28 MAD/h duo, 45 MAD/h SIM tant qu'une décision explicite ne les change pas.
6. Paiement par défaut au démarrage.
7. SQLite devient l'autorité locale domaine par domaine; le JSON legacy reste en secours jusqu'à parité prouvée.
8. Toute commande sensible doit être idempotente, auditée et rejouable.
9. Les opérations financières doivent être transactionnelles.
10. Les actions non supportées par un device doivent être marquées indisponibles, jamais simulées.
11. Toute fonctionnalité future doit être feature-flagged et avoir une Definition of Done.
12. Les fonctions Cloud/TV/Player non exécutées sur Android restent représentées dans les contrats, permissions, événements et modèles nécessaires.
13. FR/AR/EN et RTL doivent être anticipés.
14. Le mode connecté ne doit jamais rendre la tablette inutilisable hors ligne.
15. L'IA, les automatisations risquées et les écritures financières exigent les politiques/approbations prévues.

## 2. Architecture cible Android
### 2.1 Couches
- UI WebView additive existante
- Android Native Bridge
- LA PAUSE Local Core (SQLite/WAL)
- Domain Services
- Event Ledger
- Outbox/Inbox
- Sync/Reconciliation Engine
- Device/Network Bridge
- Notification Orchestrator
- Backup/Recovery
- Feature Flags / Entitlements
- Security / Secrets / Device Identity

### 2.2 Mode AUTONOME
Authority: `TABLET_PRIMARY`.
- Toutes les opérations essentielles sont locales.
- Sessions, caisse, clients, produits, stock, queue, réservations et staff continuent sans réseau.
- Events stockés localement.
- Backups locaux.
- Aucun appel Cloud obligatoire.
- L'utilisateur peut préparer une future association sans perdre ses données.

### 2.3 Mode SYNCHRONISÉ
Operating mode logique: `CONNECTED_LOCAL` puis extension Cloud.
- Pairing explicite.
- Device identity + credential.
- Handshake de compatibilité.
- Web/Edge et tablette partagent le contrat versionné.
- Outbox/inbox avec livraison at-least-once et consommateurs idempotents.
- Cursors/checkpoints.
- Conflits explicites et déterministes.
- Authority lease.
- Si Desktop/Cloud disparaît: `TABLET_EMERGENCY_PRIMARY`.
- Au retour: replay + reconciliation, jamais remplacement aveugle de l'état complet.

### 2.4 Bascule "en un clin d'oeil"
Top bar:
- AUTONOME
- WEB PRÊT
- WEB CONNECTÉ
- SYNC EN RETARD
- HORS LIGNE / MODE SECOURS

Un tap ouvre **LA PAUSE OS — Mode & Synchronisation**:
- passer en AUTONOME
- associer Desktop/Web
- scanner QR de pairing
- saisir code de pairing
- tester connexion
- statut de compatibilité
- dernière synchro
- backlog outbox
- autorité actuelle
- mode secours
- dissocier proprement

Aucun état "WEB CONNECTÉ" sans handshake réussi.

## 3. Surfaces produit et rôle de l'APK
- Desktop/Edge: moteur local lourd, agents, devices, POS/floor.
- Android Tablet: exploitation complète locale + cockpit staff/owner + secours Edge.
- Cloud: multi-site, owner remote, aggregation, configuration, backup.
- TV: overlay/fail-safe/media.
- Player: QR/PWA session/booking/queue/orders/missions.
- Network: leagues, passport, sponsors, benchmarks, marketplace.

L'APK doit comprendre les identifiants et événements de toutes ces surfaces même lorsqu'elle ne rend pas leur UI complète.

## 4. Périmètre fonctionnel canonique adapté Android

### A. Venue Operations
Gaming Floor; ressources génériques; sessions durée/budget/libre/formule/pass; pause/reprise; prolongation; déplacement; fin/libération; readiness; queue; réservation; check-in; no-show; waitlist; groupes; ouverture/fermeture; incidents; tâches staff.

### B. Finance / POS
Shift open/close; opening float; cash/card/other; payments; cash movements; expenses; corrections; refunds full/partial; credit notes; exchange; receipts; split bill; group tab; approval thresholds; reconciliation; aucun double débit.

### C. Customers / CRM / Privacy
Guest; identified guest; member; client search/create; history; Player DNA; segments; consent evidence; guardian; marketing opt-in/out; data export/correction/anonymization; retention.

### D. Loyalty / Pass / Membership / Credit
Loyalty ledger; prepaid pass; membership; included minutes/visits; rollover; benefits; venue credit; gift vouchers; referrals; Pause Points.

### E. Products / Stock / Supply
Catalogue; media; costs; margins; stock movement; linked orders; purchase orders; goods receipts; stock counts; shrink; Inventory Brain; reorder; menu engineering.

### F. Device Mesh / TV / Equipment
Registry; pairing; capabilities; heartbeat; HDMI; session lease; overlay; expiration policies; station readiness; fleet versions; controller identity; maintenance; observability; auto-heal; device security; timer integrity.

### G. Trust / Security / Owner
Append-only audit; Time Machine; Owner Sentinel; auth/team; roles/permissions; Venue Health Score; Daily Brief; opening/closing autopilot; staff task engine.

### H. Revenue Engine
Profit Autopilot; Revenue Lab; Dynamic Loyalty; Smart Seat; Lost Revenue Meter; Automation ROI; Inventory Brain; Menu Engineering; Hardware ROI; unified forecasting; Experiment/Attribution; Energy Optimizer; Staff Planner; Monthly Value Report.

### I. Player Experience
Player QR; one-tap upsell; missions/battle pass; churn radar; service requests; service recovery; party mode; smart booking; group wallet; experience score; guest-to-member; membership UX; referral/gift; family mode; responsible play; CRM communications.

### J. Competition / Community
Local Elo; matchmaker; King; tournament autopilot; auto content; game demand; release command center; spectator/live; game/license/account vault.

### K. Media / Sponsors
No Dark Station; campaign engine; creative/playlist/cache; proof-of-play; sponsor ROI; sponsor exchange foundation; redemption attribution; brand safety; settlement foundation disabled until ready.

### L. SaaS / Multi-site
Multi-tenant ids; Edge/Cloud sync; Owner Remote; Franchise/HQ; white label; control/data plane split; SaaS entitlement lease; Zero-to-Live onboarding; import/migration; i18n/RTL; SLOs; support bundle; remote config.

### M. AI / Automation / Network Effect
AI Operator; natural-language forensics; Gaming Passport; Cross-Venue League; anonymous benchmarks; Adapter SDK/Marketplace; AI provider abstraction; automation rules engine; plugin security; network privacy guard.

## 5. Modèle de ressources universel
`Resource` remplace progressivement la supposition "station = PS5".
Types initiaux:
- CONSOLE
- PC_GAMING
- SIM_RACING
- BILLIARD_TABLE
- SNOOKER_TABLE
- TABLE_TENNIS
- PRIVATE_ROOM
- CUSTOM

Capabilities:
- timedUsage
- playersMin/Max
- display
- overlay
- agent
- remoteControl
- reservation
- queue
- controllerAssets
- power
- wake
- media
- maintenance
- telemetry

La même APK doit donc pouvoir gérer une salle PS5, PC, billard ou hybride sans fork.

## 6. Données et contrats communs
Chaque entité synchronisable doit anticiper:
`id, tenantId, venueId, branchId, revision, createdAt, updatedAt, deletedAt?, originDeviceId, actorId?, correlationId?, idempotencyKey?`

Domaines minimum:
Venue, Branch, Resource, Device, Staff, Customer, Consent, Session, SessionEvent, QueueEntry, Booking, RatePlan, Payment, CashMovement, Shift, Product, Sale, StockMovement, EquipmentAsset, MaintenanceTask, Incident, Tournament, Challenge, KingSession, Membership, LoyaltyLedger, Voucher, ServiceRequest, Campaign, ProofOfPlay, AuditEvent, DomainEvent, Automation, Forecast.

## 7. Event model Android
Event envelope:
`eventId, eventType, tenantId, venueId, branchId, stationId?, deviceId?, entityType?, entityId?, actorId?, serverTimestamp/localTimestamp, payload, correlationId, causationId, idempotencyKey, severity, schemaVersion`.

Android doit produire/consommer progressivement les événements du Master V2, notamment sessions, queue, vente/paiement, shift, consentement, maintenance, devices, memberships, notifications, stock count, forecast, service request, opening/closing, auto-heal, game demand, sync conflict et entitlement.

## 8. Phases de développement Android

### A0 — Freeze & Safety Baseline
- figer v1.6.0 signée
- backup/import/export vérifiés
- CDC + Feature Matrix
- snapshot tests
- aucun changement destructif

### A1 — LA PAUSE OS Android Foundation (v1.7.x)
- version visible cohérente
- écran Mode & Synchronisation
- AUTONOME / CONNECTED_LOCAL
- Core status visible
- device/venue identity
- connection profile
- feature flags locaux
- modèle Resource universel
- sync state machine sans faux succès
- préparation pairing
- tests de bascule mode
**Livrable:** APK qui montre clairement son architecture LA PAUSE OS et reste 100% autonome.

### A2 — Local Authoritative Core
Migration SQLite progressive:
1. settings/identity/resources
2. sessions/timers/session events
3. payments/cash/shifts/refunds
4. customers/consents
5. products/sales/stock
6. queue/bookings
7. loyalty/pass/membership
8. tournaments/challenges/king
9. equipment/maintenance/incidents
10. audit/tasks/notifications

Legacy JSON reste recovery/export jusqu'à parité.

### A3 — Web/Edge Sync Contract
Dépendance: backend Web versionné prêt.
- API compatibility handshake
- pairing
- `/v1/sync` ou contrat successeur
- outbox/inbox
- cursor/checkpoints
- dedupe/idempotence
- conflict resolver
- authority lease
- emergency primary
- reconciliation
- tests croisés Android/Web

### A4 — Venue OS Complete
- resources generic UI
- floor builder
- pricing/rate plans
- readiness
- opening/closing
- queue & smart booking
- POS/caisse complet
- stock/suppliers
- staff/tasks
- backup health

### A5 — Device Mesh
- device registry
- TV/agent pairing
- health
- session lease
- overlay
- fleet
- controller assets
- observability
- auto-heal safe
- capabilities matrix

### A6 — Trust / Owner / Security
- auth local/cloud
- permissions
- append-only audit
- Time Machine
- Owner Sentinel
- Venue Health
- Daily Brief
- forensic cockpit

### A7 — Revenue Intelligence
- KPI fiables
- Profit Autopilot
- Revenue Lab
- Dynamic Loyalty
- Smart Seat
- Lost Revenue
- forecasts
- inventory/menu intelligence
- hardware ROI
- experiments/attribution
- monthly value report

### A8 — Player / CRM Growth
- QR/PWA integration
- missions
- churn
- DNA
- service requests/recovery
- memberships
- vouchers/referrals
- groups
- communications orchestrated

### A9 — Competition / Content
- Elo/matchmaker
- King
- Tournament Autopilot
- spectator mode
- game demand
- release center
- content drafts
- game/license vault

### A10 — Media Network
- campaigns
- idle media
- proof-of-play
- sponsor reporting
- redemption
- brand safety
- sponsor exchange foundation OFF until dependencies complete

### A11 — SaaS Multi-site
- tenant/venue/branch
- Cloud control plane
- Owner remote
- franchise/HQ
- white-label
- entitlements/offline lease
- onboarding/import
- FR/AR/EN/RTL
- SLO/support bundle/remote config

### A12 — AI / Automation / Network
- AI Operator with approval
- natural language forensics
- automation engine
- passport
- cross-venue league
- benchmarks
- adapter marketplace
- plugin security/privacy

## 9. Definition of Done
Une feature n'est `IMPLEMENTED` que si, selon son cas:
1. modèle domaine
2. persistance authoritative
3. command/API
4. permissions
5. event/audit
6. idempotence/concurrence
7. UI connectée
8. settings/feature flag
9. tests
10. documentation
11. migration/backward compatibility
12. offline/degraded behavior

Un bouton ou écran placeholder reste `PARTIAL`.

## 10. Gates obligatoires
Avant chaque APK:
- compilation Android
- tests migration
- no data loss
- no duplicate payment/event
- timers après sleep/clock change
- rotation/navigation
- notification background
- backup restore
- mode switch standalone/connected
- connected outage -> local continuation
- reconciliation test dès A3
- package/version/signature vérifiés

## 11. North Star Android
L'APK ne doit pas être un simple "remote control".
Elle doit pouvoir **faire tourner une venue complète seule**, devenir **compagnon synchronisé du Web/Edge** en quelques secondes, puis servir de **cockpit Owner/Staff mondial** lorsque le Cloud est présent.

`OBSERVE -> UNDERSTAND -> RECOMMEND -> EXECUTE WITH APPROVAL -> MEASURE`
