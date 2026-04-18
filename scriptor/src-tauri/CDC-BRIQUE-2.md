# CDC — Brique 2 : stockage desktop (Tauri)

Référence d’implémentation pour `storage_fs.rs`, `storageAdapter.js`, `src/platform/` (sans modifier `projectStore.js` ni `backupService.js` : la persistance passe par le pont `localStorage` + commandes Tauri).

---

## Protocole WAL — huit étapes (écriture atomique générique)

Pour chaque opération critique (`wal_atomic_write`, et chemins équivalents dans `wal_scene_write` avec étapes supplémentaires `.bak`), la séquence est :

1. **INTENT** — ajouter une ligne JSON dans `journal.log` avec `status: "INTENT"`, hachage du contenu cible lorsqu’il est connu, puis **`fsync`** du journal (et répertoire parent quand supporté).
2. **Fichier temporaire** — écrire le contenu dans un fichier `.tmp` (ou équivalent), puis **`fsync`** du fichier.
3. **Scène existante** — si un `scene-*.txt` est remplacé : journal **WRITE_BAK** (INTENT puis COMMIT), rotation `.bak` (lien dur ou renommage selon état sync cloud).
4. **Publication atomique** — **`rename`** du `.tmp` vers le fichier final, puis **`fsync`** du répertoire parent (Unix ; Windows : meilleur effort documenté dans le code).
5. **État auxiliaire** — pour les scènes : mise à jour de `checkpoints/scenes/scene-{id}.last.txt` après succès de l’écriture.
6. **COMMIT** — ajouter la ligne WAL avec `status: "COMMIT"` et le même `type` / `hash` / `sceneId`, puis **`fsync`** du journal.
7. **Manifeste / projet** — lorsque la clé est `scriptor-project-v1` : `UPDATE_STRUCTURE` (double ligne INTENT+COMMIT avec hachage de la structure canonique), bascule manifeste A/B + pointeur, snapshot périodique si autorisé (CPU, Safe Mode).
8. **Rotation** — si `journal.log` dépasse le seuil : checkpoint `journal.checkpoint.json`, lignes **ROTATE_JOURNAL** (INTENT puis COMMIT), décalage `journal.log` → `journal.1.log` → … → `journal.3.log` (suppression du plus ancien), nouveau `journal.log` vide fsync.

Lecture au redémarrage : **`journal.3.log` → `journal.2.log` → `journal.1.log` → `journal.log`** (ordre chronologique reconstitué).

---

## Types d’entrées WAL et politique au démarrage

| `type` | INTENT+COMMIT | Replay / recovery |
|--------|---------------|-------------------|
| `WRITE_SCENE` | Oui | Orphelin **non rejoué** automatiquement (risque incohérence) → **quarantaine** sous `quarantine/orphan-*.json` si INTENT sans COMMIT. |
| `WRITE_BAK` | Oui | Couplé à `WRITE_SCENE` ; pas de replay isolé. |
| `DELETE_SCENE` | Oui | INTENT orphelin → **rejoué** (suppression fichiers + checkpoint + COMMIT de recovery). |
| `WRITE_PROJECT` | Via `wal_atomic_write` | Idem scène : quarantaine si orphelin. |
| `WRITE_MANIFEST` / `SWITCH_MANIFEST` | Oui | Pas de replay automatique des orphelins. |
| `UPDATE_STRUCTURE` | Double append (hash structure) | Orphelins → quarantaine ; entrées « externes » sans hash pour sync. |
| `WRITE_METADATA` | Oui | Orphelins → quarantaine. |
| `SNAPSHOT_CREATE` | Oui | Réparation via `projet.snapshot.json` / auto-heal. |
| `SYNC_STATE` | Oui | État `.sync-state.json`. |
| `ROTATE_JOURNAL` | INTENT + COMMIT | Gouvernance rotation uniquement. |
| `SNAPSHOT` | COMMIT (restauration) | Traçabilité restore. |

Les événements notables sont aussi écrits dans **`%AppData%/Scriptor/logs/integrity.log`** (horodatage + message).

---

## Scrub disque et mtime (démarrage)

- À **`storage_init`** et après **`storage_set_active_project`** : remplissage du cache global **mtime (s) + taille** pour chaque `scenes/scene-*.txt`, avec une ligne `startup_scene_meta_warmup scenes=N mtime+size baseline` dans `integrity.log`.
- **`storage_scrub_tick`** : parcourt les scènes en round-robin ; si mtime+taille inchangés depuis la baseline, **pas de SHA-256** (log `scrub skip unchanged`), sinon hash et log `scrub ok`.

---

## Ordre des scènes dans le journal de structure

Le champ canonique `order` pour `UPDATE_STRUCTURE` est dérivé des indices **`volume.chapitre.scène`** dans le JSON projet (`vi.ci.si`). Ce n’est pas un **fractional index** au sens string entre deux clés voisines ; une évolution future du modèle pourrait introduire des clés de rang fractionnaires côté JSON — le WAL actuel reste compatible tant que la fonction `canonical_structure_rows` est alignée sur le modèle.

---

## Conflits et fusion

- Fichiers `scene-*_CONFLICT_*.txt` et `manifest_CONFLICT_*.json` ; résolution `local` | `conflict` | fusion manuelle (`storage_resolve_conflict_merge`).
- Nettoyage automatique des conflits > 30 jours (`cleanup_old_conflicts`).

---

## MSI / désinstallation (Windows)

Le build **`npm run tauri:build`** produit un installateur **WiX (.msi)**. Windows enregistre le produit dans **Paramètres → Applications → Applications installées** : l’utilisateur peut **Désinstaller** comme pour tout logiciel MSI standard (pas d’artefact séparé « uninstall.exe » : le moteur MSI gère la désinstallation).

---

## Validation manuelle rapide (dev web + bureau)

1. **Web** : `cd scriptor && npm run dev` — l’app doit servir sur le port Vite attendu (ex. 5173).
2. **Bureau** : `npm run tauri:dev` — fenêtre native, même UI, stockage via le pont desktop.
3. **Gate automatisé** : `npm run cdc:gate` (lint, build, stress, `cargo check`, compile backend).

---

## Grille de critères (synthèse 50 points)

Les numéros correspondent à la grille Brique 2 historique ; statut **OK** = couvert par le dépôt tel qu’implémenté au moment de ce document.

| # | Critère | Statut |
|---|---------|--------|
| 1 | Données projet sous `Documents/Scriptor/<slug>/` | OK |
| 2 | Pas de modification de `projectStore.js` / `backupService.js` pour la brique 2 | OK (pont storage uniquement) |
| 3 | Préférences / machine / crash-state sous `%AppData%/Scriptor/` | OK |
| 4 | Journal WAL append-only + fsync | OK |
| 5 | INTENT / COMMIT pour écritures atomiques | OK |
| 6 | Fichiers temporaires + rename | OK |
| 7 | Rotation journal + chaînage `journal.[1-3].log` | OK |
| 8 | Checkpoint scènes avant rotation | OK |
| 9 | Recovery checkpoint → `scene-*.txt` depuis `.last.txt` | OK |
| 10 | Replay orphelin `DELETE_SCENE` | OK |
| 11 | Quarantaine autres INTENT orphelins | OK |
| 12 | Double manifeste A/B + pointeur HLC | OK |
| 13 | Snapshot périodique `projet.snapshot.json` (garde CPU / Safe Mode) | OK |
| 14 | Reconstruction `projet.json` (snapshot → scènes) | OK |
| 15 | Scrub incrémental + hash (round-robin) | OK |
| 16 | Skip scrub si mtime+taille inchangés (cache) | OK |
| 17 | Garde disque plein (ENOSPC) | OK |
| 18 | Mode lecture seule si espace critique | OK |
| 19 | Safe Mode (crash / anomalies) + sortie auto 10 min | OK |
| 20 | Auto-heal snapshot après 3 anomalies / 60 s | OK |
| 21 | Verrou instance `.lock` | OK |
| 22 | Détection double instance | OK |
| 23 | Nettoyage `*.tmp` au démarrage | OK |
| 24 | Chemins étendus Windows `\\?\` | OK |
| 25 | Conflits fichier scène + manifeste | OK |
| 26 | Fusion manuelle (ghost merge) | OK |
| 27 | Liste / lecture charge utile conflit | OK |
| 28 | Reporter anomalies + événements → `integrity.log` | OK |
| 29 | Garde « sync loop » (seuil configurable 0,5–1,0) | OK |
| 30 | **Baseline mtime+taille toutes les scènes au démarrage** (`warm_scrub_meta_cache`) | OK |
| 31 | Échantillon CPU global (`sysinfo`) | OK |
| 32 | `storage_external_mutation` pour sync cloud | OK |
| 33 | Snapshot manuel + restore | OK |
| 34 | Export d’urgence bureau | OK |
| 35 | `storage_health` | OK |
| 36 | Bridge `localStorage` debounce projet | OK |
| 37 | Bootstrap `storage_bootstrap` → seed LS | OK |
| 38 | Commandes Tauri enregistrées dans `lib.rs` | OK |
| 39 | Plateforme `DesktopBootstrap` / Provider | OK |
| 40 | Splash / assets | OK |
| 41 | Toolchain Rust pin (`rust-toolchain.toml`) | OK |
| 42 | Node `.nvmrc` | OK |
| 43 | Build MSI `tauri.conf.json` | OK |
| 44 | SmartScreen / notes utilisateur | OK (README + RELEASE-NOTES) |
| 45 | Désinstallation via MSI / Paramètres Windows | OK |
| 46 | Stress `project-store` / backup / global | OK (`stress-suite`) |
| 47 | Gate `cdc:gate` | OK |
| 48 | CSP / WebView2 (config Tauri) | OK |
| 49 | `UPDATE_STRUCTURE` tracé | OK |
| 50 | Métadonnées `metadata.json` + test manuel `npm run dev` documenté | OK |

---

## Fichiers clés

- `src-tauri/src/storage_fs.rs` — WAL, recovery, scrub, conflits.
- `src/storageAdapter.js` — debounce, scheduler scrub, sync loop, invoke.
- `src/platform/DesktopBootstrap.tsx` — amorçage bureau, conflits UI.
- `scripts/cdc-gate.mjs` — validation continue.
