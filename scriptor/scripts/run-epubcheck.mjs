#!/usr/bin/env node
/**
 * Validation EPUB optionnelle avec le JAR officiel EPUBCheck (Java).
 *
 * Prérequis : Java sur le PATH + variable d'environnement EPUBCHECK_JAR
 * pointant vers epubcheck.jar (téléchargement : https://github.com/w3c/epubcheck/releases)
 *
 * Usage :
 *   EPUBCHECK_JAR=C:\outils\epubcheck.jar node scripts/run-epubcheck.mjs chemin/vers/livre.epub
 *   npm run epubcheck -- chemin/vers/livre.epub
 *   npm run epubcheck -- livre.epub --quiet
 */

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'

const jar = process.env.EPUBCHECK_JAR || process.env.SCRIPTOR_EPUBCHECK_JAR
const epubPath = process.argv[2]
const epubcheckExtraArgs = process.argv.slice(3)

if (!epubPath) {
  console.error(
    'Usage: EPUBCHECK_JAR=/chemin/epubcheck.jar npm run epubcheck -- chemin/livre.epub [args EPUBCheck...]\n' +
      'Sans JAR : définissez EPUBCHECK_JAR (voir https://github.com/w3c/epubcheck/releases)',
  )
  process.exit(2)
}

const abs = resolve(epubPath)
if (!existsSync(abs)) {
  console.error(`Fichier introuvable : ${abs}`)
  process.exit(1)
}

if (!jar || !existsSync(jar)) {
  console.warn(
    '[epubcheck] EPUBCHECK_JAR non défini ou fichier absent — saut de la validation.\n' +
      '  Téléchargez epubcheck-all.jar depuis les releases W3C EPUBCheck, puis :\n' +
      '  set EPUBCHECK_JAR=C:\\chemin\\epubcheck.jar',
  )
  process.exit(0)
}

const r = spawnSync('java', ['-jar', jar, abs, ...epubcheckExtraArgs], {
  stdio: 'inherit',
  encoding: 'utf-8',
})

process.exit(r.status ?? 1)
