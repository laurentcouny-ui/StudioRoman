#!/usr/bin/env node
/**
 * Affiche où se trouvent les installateurs après `npm run tauri:build`
 * (dossiers réels listés si le build a déjà été exécuté).
 */
import { readdir, readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const scriptorRoot = join(__dirname, '..')
const tauriConfPath = join(scriptorRoot, 'src-tauri', 'tauri.conf.json')
const pkgPath = join(scriptorRoot, 'package.json')

let productName = 'Scriptor'
let version = '1.0.0'
try {
  const pkg = JSON.parse(await readFile(pkgPath, 'utf8'))
  version = pkg.version ?? version
} catch {
  /* ignore */
}
try {
  const conf = JSON.parse(await readFile(tauriConfPath, 'utf8'))
  productName = conf.productName ?? productName
  version = conf.version ?? version
} catch {
  /* ignore */
}

const targetRelease = join(scriptorRoot, 'src-tauri', 'target', 'release', 'bundle')
const nsisDir = join(targetRelease, 'nsis')
const msiDir = join(targetRelease, 'msi')

async function listFiles(dir) {
  try {
    const names = await readdir(dir)
    return names.filter((n) => n.endsWith('.exe') || n.endsWith('.msi'))
  } catch {
    return []
  }
}

const nsisFiles = await listFiles(nsisDir)
const msiFiles = await listFiles(msiDir)

const lines = [
  '',
  `Scriptor ${version} — paquets de distribution Windows`,
  '═'.repeat(56),
  '',
  '1) Lancer le build release (depuis le dossier scriptor/) :',
  '     npm run tauri:build',
  '',
  '   Prérequis Windows : Rust, Visual Studio Build Tools, NSIS 3+ (pour le .exe),',
  '   WiX Toolset v3 (pour le .msi).',
  '',
  '2) Fichiers générés (chemins relatifs au repo) :',
  '',
  `   • Installateur WEB (.exe, NSIS) — à héberger pour téléchargement :`,
  `     scriptor/src-tauri/target/release/bundle/nsis/`,
  `     → ${productName}_${version}_x64-setup.exe (nom typique)`,
  '',
  `   • Installateur MSI (déploiement / entreprise) :`,
  `     scriptor/src-tauri/target/release/bundle/msi/`,
  `     → ${productName}_${version}_x64_fr-FR.msi (nom typique)`,
  '',
]

if (nsisFiles.length) {
  lines.push('   Fichiers NSIS détectés :')
  for (const f of nsisFiles) lines.push(`     • ${join('scriptor/src-tauri/target/release/bundle/nsis', f)}`)
  lines.push('')
}
if (msiFiles.length) {
  lines.push('   Fichiers MSI détectés :')
  for (const f of msiFiles) lines.push(`     • ${join('scriptor/src-tauri/target/release/bundle/msi', f)}`)
  lines.push('')
}

lines.push(
  '3) Mise en ligne : déposez sur votre site le fichier *-setup.exe (ou le .msi)',
  '   en HTTPS ; signez l’installateur (certificat code signing) pour éviter',
  '   les avertissements SmartScreen.',
  '',
  '4) Les utilisateurs n’ont pas besoin de Node ni Rust : uniquement Windows 10/11',
  '   x64 et le runtime WebView2 (l’installateur peut le proposer au besoin).',
  '',
)

console.log(lines.join('\n'))
