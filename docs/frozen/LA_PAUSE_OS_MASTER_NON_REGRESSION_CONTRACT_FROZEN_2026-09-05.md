# LA PAUSE OS — MASTER NON-REGRESSION CONTRACT
## FROZEN — 2026-09-05

**Statut : FIGÉ / NON NÉGOCIABLE**

Ce document est la référence fonctionnelle obligatoire de LA PAUSE OS.
Toute nouvelle version Android/Web/SaaS doit être un **superset** du produit existant.
Une nouvelle interface ne donne jamais le droit de supprimer une fonction, un comportement, une persistance ou une garantie déjà validée.

Les templates visuels #01→#44 sont figés séparément par le **CANONICAL TEMPLATE LOCK**.
L'implémentation doit respecter leur composition visuelle **pixel-for-pixel au niveau de la référence canonique**, sans redesign, recoloration, simplification ou substitution arbitraire.

---

## 01. UI / templates figés 01→44
- Les 44 templates validés sont la référence visuelle absolue.
- Aucune nouvelle palette.
- Aucun nouveau composant inventé.
- Aucun ancien écran réintroduit.
- Aucun “design inspiré de”.
- Même structure, images, cartes, boutons, tabs, espacements et hiérarchie visuelle.
- Les écrans supplémentaires ne doivent jamais casser ni remplacer ces 44 références.
- Les fonctions absentes visuellement des templates doivent être intégrées intelligemment derrière ou via sous-écrans cohérents, sans mutiler les templates.

## 02. Nouveau SaaS complet, pas une APK démo
- Produit vendable.
- Identité SaaS réelle.
- Account.
- Organization.
- Tenant.
- Workspace.
- Venue.
- Branch.
- Multi-tenant strict.
- Multi-site.
- Owner Remote.
- Franchise / HQ.
- White label.
- Subscription.
- Entitlements.
- Modules.
- Trials.
- Plans.
- Billing state.
- Renewal.
- Grace period.
- Suspension policy.
- Offline entitlement lease signé.
- Aucun blocage brutal d’une salle locale si Internet tombe.

## 03. Onboarding SaaS
- Doit reprendre exactement la logique visuelle du template #08.
- Account & Organization.
- Select Venue & Branch.
- Business Model & Pricing.
- Resources & Floor Layout.
- Team & Access.
- Review & Go Live.
- En dessous, le moteur réel doit couvrir aussi : locale, timezone, currency, stations, network discovery, device pairing, pricing, products/stock, staff, payment modes, test session, test sale, backup check, GO LIVE, readiness score, blockers.
- Pas de checklist ridicule remplaçant le vrai onboarding.

## 04. Navigation Android
- Retour interne obligatoire.
- **Swipe vers la droite = retour d’un niveau.**
- Le bouton Retour Android ne doit jamais fermer brutalement l’app.
- Une modal se ferme d’abord.
- Une fiche/drawer se ferme d’abord.
- Ensuite retour au sous-écran précédent.
- Ensuite écran précédent.
- À la vraie racine seulement : confirmation avant quitter.
- Historique de navigation interne.
- Pas de retour systématique Home.
- Pas de perte d’état lors du retour.

## 05. Rotation téléphone / tablette
- Portrait → paysage sans fermer l’écran.
- Paysage → portrait sans revenir Home.
- Conserver : écran, sous-écran, drawer, session sélectionnée, ressource sélectionnée, client, filtres, recherche, formulaire, panier, étape onboarding, scroll pertinent.
- Responsive téléphone petit/grand.
- Responsive tablette petite/grande.
- Vrai layout paysage, pas simple compression du portrait.

## 06. Images / médias
- Images premium haute qualité.
- Images dynamiques.
- Même direction visuelle que les templates.
- Pas de rectangles/emoji de remplacement.
- Console libre ≠ console occupée.
- Jeu actif affichable.
- SIM, PC, billard, snooker, ping-pong, room, custom : médias propres.
- Produits/snacks avec vraies images.
- Recadrage contrôlé.
- Pas de déformation.
- Adaptation portrait/paysage.
- Aucun remplacement silencieux des assets validés.
- Hash des assets canoniques.

## 07. Control Center operator-first
- Dashboard réellement utile pour l’opérateur.
- Pas un dashboard marketing décoratif.
- Actions immédiates visibles.
- Ressources actives.
- Sessions qui terminent bientôt.
- Paiements.
- Incidents.
- Queue.
- Réservations.
- Device health.
- Opportunités de revenus.
- Next Best Action.
- Minimiser clics et secondes.

## 08. Parcours PS5 / console
- Session par temps, budget, fixe, ouverte/libre si autorisée.
- Solo / Duo.
- Paiement cohérent avec le type de session.
- Paiement par défaut en avance.
- **PS5 Duo 30 min en maximum 3 actions opérateur.**
- +30 min, +1 h, +2 h, add-ons, snack, fin session.
- Interdiction des anciens sélecteurs `#payNow`, `data-duration`, `data-players`.

## 09. Billard / snooker
- Parcours distinct des consoles.
- Facturation **par partie**.
- 1 / 3 / 5 parties.
- Parties achetées, jouées, restantes.
- Prix par partie, total.
- **+1 partie** immédiat.
- Aucun faux timer négatif.

## 10. Tous les types de ressources
CONSOLE, PC_GAMING, SIM_RACING, BILLIARD_TABLE, SNOOKER_TABLE, TABLE_TENNIS, PRIVATE_ROOM, CUSTOM. Chaque type garde champs, tarification, actions, historique, règles, médias, capacités. Aucun hard-code “tout est PS5”.

## 11. Floor Builder
Zones, ressources, types, statut, disponibilité, maintenance, session active, réservation, capacités, layout configurable, ajout/suppression/modification. Aucun hard-code de stations.

## 12. Next Best Action
Recommandation sur données réelles, action réellement exécutable, retour Control Center après acceptation, incrément réel `acceptedActions`, incrément réel `assistedRevenue` si attribuable, impact mesuré, aucun faux KPI.

## 13. Revenue Engine
+30 min, +1 partie, snack, combo, upgrade, prolongation, fill empty stations, réengagement, flash promotion, contextual upsell, Revenue Moments, Assisted Revenue, Lost Revenue Meter, Profit Autopilot, Revenue Lab, Smart Seat, Dynamic Loyalty, Inventory Brain, Menu Engineering, Hardware ROI, Forecast, Experiment Attribution, Staff Planner, Monthly Value Report.

## 14. Client passage
Guest réel, identified guest, member, recherche/création rapide, identification, historique, conversion guest→membre sans casse de données.

## 15. CRM / Client 360
Profil, téléphone/email, historique sessions/achats, dépenses, visites, tags, segments, consents, guardian/family, Player DNA, Churn Radar, communication, check-in, booking, credits, message, offer.

## 16. Membership / loyalty
Points ledger, memberships, passes prépayés, minutes/heures/visites, credits, rollover, vouchers, rewards, referral, Pause Points, niveaux configurables.

## 17. POS / Smart Cart
Catalogue réel, recherche, barcode, SKU, produits/services/passes/snacks/boissons/merch, quantités, remise, taxe, total, paiement, dine in, takeaway, venue tab, split bill, aucun double débit.

## 18. Caisse
Ouverture shift, float, cash/card/mobile/credits, mouvements, dépenses, cash drop, expected/count, différence, clôture, réconciliation, correction, refund, credit note, exchange, receipt. Dépense ≠ CA.

## 19. Produits / stock
Catalogue, vraies images, prix, coût, marge, stock, quantités, mouvements, ventes liées au stock, persistance après update, alerte stock bas.

## 20. Inventory / achats / fournisseurs
Suppliers, PO, goods receipt, inventory movements, counts, shrink, reorder, Inventory Brain, Menu Engineering, achats, historique fournisseur.

## 21. Réservations
Calendar/timeline/floor/resources, confirmed/pending/check-in/no-show/reschedule/walk-in/groups/resource assignment/smart booking. Une réservation impayée ne bloque pas éternellement.

## 22. Queue / waitlist
File réelle, temps estimé, préférence ressource, auto-assign, notify next, priorités, VIP/member configurable, live display, optimisation places vides, liaison sessions.

## 23. Tournois
Création, inscription, paiement, check-in, qualif, seeding, brackets, stations, planning, scores, no-show, disputes, progression, podium, gagnant, rewards, profit. Jamais bloqué avant finale.

## 24. Challenges / communauté
Challenges, classements, Hall PS5, King, Local Elo, Matchmaker, missions, battle pass, communauté, autopilot si activé.

## 25. Player Portal / PWA
QR/PWA, one-tap upsell, extension, snack, appel staff, problème manette, service request, missions, referral, gift, party/family, responsible play, service recovery.

## 26. Device Control
Registry, pairing, capabilities, heartbeat, identity, TV/stations, session lease, overlay, fleet/version/controllers/maintenance/observability/safe auto-heal/LAN/scanner ARP-MAC/IP dynamique/heartbeat 30s. Jamais de fake success, jamais d’overlay HDMI universel non prouvé.

## 27. Notifications Android
Natives, background, app minimisée, écran éteint, bientôt terminée, fin session, dépassement critique, alertes configurables, persistance si nécessaire.

## 28. Mode autonome / offline
Android fonctionne seul, sans PC/Cloud/Internet. Sessions, caisse, stock, queue et devices locaux continuent. Sync plus tard.

## 29. Edge + Cloud
Edge autorité locale; Cloud provisioning/config/owner/analytics/backups/entitlements/campaigns. Outbox/inbox/event IDs/replay/dedupe/expectedRevision/conflicts/device identity/sync incrémentale/reprise/pas double écriture.

## 30. Contrat de sync
`POST /v1/sync`, schemaVersion, branchId, deviceId, cursor, events, clientRevision, clientTime, IDs universels, revisions, timestamps, event log, conflits, vérité commune Web/Android/Cloud.

## 31. Web / Android parity
Gaming Floor, Sessions, Tarifs, Clients, Produits, Caisse, Tournois, Challenges, Réservations, File d’attente, Historique, TV/Stations, Notifications, Paramètres. Aucune divergence de données.

## 32. Historique
Sessions, paiements, commandes, produits, clients, incidents, actions staff, device events, refunds, corrections, audit, recherche/filtrage, persistance update.

## 33. Analytics
Revenue, players, session duration, occupancy, venue comparison, device data, trends, forecast, KPI reconstructibles, aucun chiffre fictif.

## 34. Owner Command Center
All tenants/venues, revenue consolidé, players, active venues, occupancy, alerts, approvals, branches, audit, devices, backups, drill-down.

## 35. Franchise / HQ
Policies, templates, pricing rules, product catalog, campaigns, permissions, device standards, benchmarks, config distribution, multi-client control.

## 36. White label
Logo, brand, colors, receipt, Player PWA, TV, domain, emails, templates, par tenant/client.

## 37. RBAC / sécurité
Owner, Tenant Admin, Manager, Staff, Support, custom roles, permissions module/action, scopes tenant/venue/branch/device, role≠entitlement, MFA, session monitoring, IP/device authorization, audit, fail-closed release.

## 38. Entitlement M01→M15
M01_OPERATIONS, M02_POS, M03_INVENTORY, M04_FINANCE, M05_CRM, M06_MARKETING, M07_BOOKINGS, M08_TOURNAMENTS, M09_DEVICE_CONTROL, M10_ANALYTICS, M11_PLAYER_PORTAL, M12_TEAM_ADVANCED, M13_MULTI_SITE, M14_API_INTEGRATIONS, M15_AI_OPERATOR. Dépendance M06→M05. Activation réelle.

## 39. Sécurité produit
Signed entitlement ECDSA P-256, isolation tenant/venue/branch, device scopes, membership, roles, permissions, integrity check Android, anti-tampering raisonnable, audit, idempotency, aucun secret dans logs/support.

## 40. Command protocol
`protocolVersion: la-pause-client/2`, schemaVersion 2, commandId, idempotencyKey, commandType, tenant, venue, branch, actor, device, issuedAt, baseRevision, payload. `type`/`expectedRevision` uniquement frontière native temporaire.

## 41. Import / migration
Customers CSV, balances/points, products, price lists, assets, membership/pass compatible, preview, mapping, validation, dry-run, import, reconciliation report, rollback/compensating plan.

## 42. Sauvegardes
Backup local/Cloud, validation, restore, santé, aucune suppression données lors d’update.

## 43. Support / diagnostics
Bundle redacted, versions, health, config non secrète, erreurs, devices, outbox, backup health; aucun token/PIN hash/secret/PII inutile.

## 44. Observabilité / Venue Health
Command latency, POS write latency, realtime availability, sync backlog, device reconnect, error rate, backup success, restore success, dashboard santé, alerting.

## 45. Owner Sentinel / audit
Audit append-only, Time Machine, Owner Sentinel, forensics, sensitive actions, who/when/where/device, aucune suppression silencieuse.

## 46. AI Operator
Recommandations données réelles, actions proposées, human approval risques, NL forensics, automation rules, résultats mesurés, aucun faux AI.

## 47. Marketing
Campaigns, offers, gifts, segments, re-engagement, churn recovery, conversion opportunities, attribution ventes.

## 48. Media / Sponsors
No Dark Station, creative library, playlists, offline cache, proof-of-play, Sponsor ROI, QR/coupon attribution, brand safety, approval, données agrégées. Sponsor Exchange OFF tant que prérequis non validés.

## 49. Internationalisation
FR/AR/EN, RTL réel, currency, décimales, dates/heures, taxes, reçus, timezone, structure traduisible.

## 50. UX opérateur
Touch targets larges, aucun double bouton Sessions, KPI utiles, menu mobile/tablette, gestes cohérents, actions prioritaires, pas de formulaires/navigation inutiles, optimisation du nombre de secondes.

## 51. Persistance
Clients, sessions, panier, caisse, stock, paramètres, pairing, workspace, branch, screen/subscreen, filters, rotation state, données conservées après update APK.

## 52. Pas de fake / placeholders
Aucun KPI fictif, network/device success fictif, faux AI ou mock visible. Indisponible = explicitement indisponible.

## 53. Pas de hard-code métier
Prix, resource types, stations, taxes, currency, plans, products, business model, venue structure configurables. Aucune valeur LA PAUSE CLUB imposée à un client SaaS.

## 54. Build / release
Package `com.lapauseclub.manager`, signature permanente, certificat vérifié, APK signée, SHA-256, Product CI, native smoke, navigation, rotation, responsive, offline, permissions, entitlement, parcours métier A→Z. **Jamais FINAL tant que tout n’est pas vert.**

## 55. Principe absolu de cette semaine
- **On n’enlève aucune fonctionnalité importante déjà développée.**
- On ajoute, améliore, optimise et fusionne intelligemment.
- On ne recommence jamais une logique déjà validée.
- La nouvelle UI est un **superset** de tout l’existant.
- Une nouvelle maquette ne donne jamais le droit de supprimer une fonction.
- Toute perte d’un comportement validé = **régression bloquante**.

---

# CANONICAL TEMPLATE LOCK — 10 BOARDS / 44 SCREENS

Dimensions canoniques : **1672×941 px par planche**.

| Board | Screens | SHA-256 |
|---|---|---|
| board01_01-05.png | #01–#05 | `549a304f62fc15fa81957c87213b19339f971625fb94481e52db854e6a15af06` |
| board02_06-10.png | #06–#10 | `a648c9d4258aad8d32285d97c4aa1d107cf4bbf513dd7488a067c50779ad3163` |
| board03_11-14.png | #11–#14 | `dafb63a97eb46147226bd0921704dd83d9fd2a82f4f73e2519e4af66ff2cecf6` |
| board04_15-19.png | #15–#19 | `d638ee81c65ef0414e9568d46970e42432acf21efa3865a7206056253f3bf8e3` |
| board05_20-23.png | #20–#23 | `86185153e5fd22cd349c60d42eca1d435b1af2216459f053f943439ddb46f532` |
| board06_24-27.png | #24–#27 | `8bba7dbe6b0357408681a444c2ea876cdaeb818ac5d6ef9cd21348d381581420` |
| board07_28-31.png | #28–#31 | `194c77ae4ca4142836034dfa982c6a766bc4f71bf2c1e5d277e4b4e32e25569d` |
| board08_32-35.png | #32–#35 | `3d2ee7ba1f28d1dcf0b2e466bbfb07d797b5d74eb549eb6964b8adb0aee45b38` |
| board09_36-39.png | #36–#39 | `2a29b6b512693a2410fef69af25bbab1f771df93d403a86ec159c0418cf66dba` |
| board10_40-44.png | #40–#44 | `4942a265e6b35c69fdff62d75a0ebe2a1b82795b4708358b9b0b89fb76988ba5` |

## Règle append-only pour les nouvelles demandes
À partir du 2026-09-05, toute nouvelle exigence utilisateur concernant LA PAUSE OS doit être ajoutée à ce document ou à son journal append-only **avant** l’implémentation. Une exigence existante ne peut être supprimée ou affaiblie sans instruction utilisateur explicite.

## Règle de rendu
- Jamais de redesign libre.
- Proportions, positions, images, couleurs et hiérarchie reproduites depuis la référence canonique.
- Responsive = adaptation fidèle, pas nouvelle UI.
- Toute dérive visuelle non explicitement validée = release bloquée.
