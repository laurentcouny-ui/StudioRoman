#!/usr/bin/env node
/**
 * Aide : journalisation détaillée du chargement Scriptor (navigateur / WebView).
 * Pas d’exécution de l’app — affiche seulement les modes d’activation.
 */
const lines = [
  '',
  'Scriptor — diagnostic d’initialisation',
  '────────────────────────────────────',
  '1) Mode Vite dédié (variable dans .env.diagnostic) :',
  '     cd scriptor && npm run dev:diag',
  '',
  '2) Sans changer de script : ajoutez dans .env.local :',
  '     VITE_INIT_DIAGNOSTIC=1',
  '',
  '3) Ou ouvrez l’app avec :',
  '     ?initDiag=1',
  '   (mémorisé pour l’onglet via sessionStorage)',
  '',
  'La console (F12) affiche des lignes [Scriptor:init] … puis une séquence',
  'd’imports isolés (probe) après le premier rendu.',
  '',
]
console.log(lines.join('\n'))
