# CDC — Brique 3 : Parser de manuscrit + nettoyage typographique

Application **Scriptor Desktop V2** (Tauri). Cette note aligne le dépôt sur le cahier des charges **v8 Brique 3** : les éléments ci-dessous sont considérés **couverts** dans l’implémentation actuelle.

---

## Principes (respectés)

1. **Souveraineté** : corrections toujours proposées, jamais auto-appliquées sans case explicite.
2. **Source** : le fichier utilisateur n’est pas modifié par Scriptor ; Shadow Merge + hash disque.
3. **Extension** : `parseImportedText` / `projectStore` conservés pour le flux texte historique.
4. **AST** : `buildAstFromParsed` + `rootHash` (aperçu) ; contrôle de dérive à l’import (empreinte AST + 50 mots).
5. **Staging** : `.tmp_import/<importId>/staged_scenes/` puis **`import_commit_staged_scenes`** → écriture scènes via **WAL** (`wal_scene_write_project_dir`).
6. **Double validation** : dialogue d’import enrichi (staging WAL, dérive AST / fingerprint, confirmation finale CDC).

---

## Implémenté (synthèse)

| Élément | Détail |
|--------|--------|
| **Préflight / sessions / heartbeat / cleanup** | Inchangé ; cleanup stale ne supprime que `.tmp_import/<importId>/` (pas tout le dossier). |
| **Shadow Merge** | Hash + reset + override ; **merge manuel** : comparaison 1ʳᵉ scène côte à côte, remplacement d’aperçu (session réinitialisée). |
| **Backup / journal / rollback JS** | Inchangé. |
| **Restauration disque Rust** | `import_restore_from_pre_import_backup` + UI liste des journaux récents. |
| **Staging → WAL** | `import_stage_scene_text` + `import_commit_staged_scenes` ; flux desktop dans `ImportTab` + `deferSceneWrite` dans `handleImportFromText`. |
| **Fingerprint** | SHA-256 des 50 premiers mots sur `joinedPlainFromParsed` ; comparaison à l’import dans le `confirm`. |
| **PDF avancé** | Colonnes (lecture gauche puis droite si largeur suffisante), **RTL** (`dir === 'rtl'`), **notes de bas de page** (bande basse + petite police). |
| **Scoring** | Titres de chapitres vs entrées Bible (Levenshtein) ; noms `project.characters` vs tokens du début du texte (Δ≤2). |
| **PDF → paragraphes** | Voir ligne historique + heuristiques ci-dessus ; test `npm run test:pdf-reconstruct`. |

**Fichiers** : `src-tauri/src/import_backup.rs`, `src-tauri/src/import_session.rs`, `src-tauri/src/storage_fs.rs`, `src/import/**`, `src/ImportTab.jsx`, `src/App.jsx`.

---

## Commandes Tauri (Brique 3)

- `import_preflight_write` `{ projectSlug }`
- `import_session_save` / `import_session_load` / `import_session_touch_heartbeat` / `import_cleanup_stale_sessions`
- `import_pre_import_backup` / `import_read_backup_projet_json`
- `import_save_log` / `import_load_log` / `import_list_recent_logs`
- **`import_stage_scene_text`** `{ projectSlug, importId, sceneId, text }`
- **`import_commit_staged_scenes`** `{ projectSlug, importId }` → `u32`
- **`import_restore_from_pre_import_backup`** `{ projectSlug, backupPath }`

---

## Format pivot (rappel)

- `**texte**` gras ; `*texte*` italique ; `__texte__` souligné ; `{note: "..."}` note ; `[toc]` ancre ; `[image_ref]` image signalée.

---

## Dépendances npm

- `mammoth` — Word → HTML  
- `pdfjs-dist` — PDF → texte (chunk async)

---

## Améliorations futures (hors CDC strict)

- Fingerprint **fichier** vs **mémoire** après édition manuelle de l’aperçu (UI).
- Merge manuel **éditeur** à champs fusionnés (au-delà de remplacer l’aperçu).
- Colonnes / RTL / notes PDF : affinage par `viewport` page et détection de **gouttière** explicite.
