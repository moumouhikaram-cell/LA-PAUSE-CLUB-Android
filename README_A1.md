# LA PAUSE OS Android A1 — Dual Mode Core

A1 is the first standalone-first Android foundation.

A billiard venue with one Android tablet, no PC, no router and no Internet can create resources, start/stop timed sessions, record payment, see local revenue and create verified backups.

Desktop and Cloud synchronization are optional future capabilities, not runtime prerequisites.

Build with `.github/workflows/build-a1-dual-mode.yml`.
Expected artifact: `LA-PAUSE-OS-A1-Dual-Mode-debug.apk`.


## Windows — méthode recommandée
Ne double-cliquez pas directement sur `INSTALL_A1_TO_GITHUB.ps1`.

Double-cliquez sur :

`LANCER_A1.bat`

Le lanceur :
- vérifie que Git est installé ;
- lance PowerShell avec `ExecutionPolicy Bypass` uniquement pour cette exécution ;
- garde la fenêtre ouverte ;
- affiche l'erreur exacte si quelque chose bloque.


## Push Fix V2
Cette version corrige le cas d'une installation Git neuve sans identite de commit configuree. Elle verifie aussi chaque code de sortie Git et confirme que le SHA distant correspond au SHA local.
