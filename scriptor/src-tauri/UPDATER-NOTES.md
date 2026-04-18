# Mise à jour native (futur)

La vérification des versions sur GitHub est faite côté front (`src/platform/updateCheckCore.ts`) avec timeout, cache 24 h et comparaison semver.

Pour une distribution professionnelle (bundles signés, deltas, canal stable/bêta), migrer vers le **plugin officiel `tauri-plugin-updater`** (Tauri Updater) et retirer ou désactiver la logique GitHub embarquée dans l’UI, une fois les clés de signature et l’endpoint configurés.
