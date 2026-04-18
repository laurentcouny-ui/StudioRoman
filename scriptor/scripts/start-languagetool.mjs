#!/usr/bin/env node
/**
 * Démarre le serveur HTTP LanguageTool en local (port 8010 par défaut).
 * Usage : depuis le dossier scriptor, `npm run lt:server`
 * Prérequis : après `npm run vendor:languagetool-bundled`, JRE + JAR dans src-tauri/resources/languagetool/ ;
 * sinon JRE sur le PATH + JAR (voir README).
 *
 * Variables d’environnement :
 * - SCRIPTOR_LANGUAGETOOL_JAR, BOOKNOTE_LANGUAGETOOL_JAR ou LANGUAGETOOL_JAR : chemin du JAR
 * - SCRIPTOR_LANGUAGETOOL_PORT : port (défaut 8010)
 */

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DEV_BUNDLED_JAR = path.join(ROOT, 'src-tauri', 'resources', 'languagetool', 'languagetool-server.jar')
const DEV_BUNDLED_JAVA_WIN = path.join(ROOT, 'src-tauri', 'resources', 'languagetool', 'jre', 'bin', 'java.exe')
const DEV_BUNDLED_JAVA_UNIX = path.join(ROOT, 'src-tauri', 'resources', 'languagetool', 'jre', 'bin', 'java')

const APP_DIR_NAME = 'fr.scriptor.desktop'
const JAR_NAME = 'languagetool-server.jar'

function appLocalLtJar() {
  const h = os.homedir()
  if (process.platform === 'win32') {
    const local = process.env.LOCALAPPDATA || path.join(h, 'AppData', 'Local')
    return path.join(local, APP_DIR_NAME, 'languagetool', JAR_NAME)
  }
  if (process.platform === 'darwin') {
    return path.join(h, 'Library', 'Application Support', APP_DIR_NAME, 'languagetool', JAR_NAME)
  }
  return path.join(h, '.local', 'share', APP_DIR_NAME, 'languagetool', JAR_NAME)
}

function resolveJar() {
  for (const key of [
    'SCRIPTOR_LANGUAGETOOL_JAR',
    'BOOKNOTE_LANGUAGETOOL_JAR',
    'LANGUAGETOOL_JAR',
  ]) {
    const v = process.env[key]?.trim()
    if (v && fs.existsSync(v)) return v
  }
  if (fs.existsSync(DEV_BUNDLED_JAR)) return DEV_BUNDLED_JAR
  const def = appLocalLtJar()
  if (fs.existsSync(def)) return def
  return null
}

function resolveJavaExe() {
  if (process.platform === 'win32' && fs.existsSync(DEV_BUNDLED_JAVA_WIN)) return DEV_BUNDLED_JAVA_WIN
  if (process.platform !== 'win32' && fs.existsSync(DEV_BUNDLED_JAVA_UNIX)) return DEV_BUNDLED_JAVA_UNIX
  return 'java'
}

const jar = resolveJar()
if (!jar) {
  console.error(
    `[LanguageTool] JAR introuvable. Placez « ${JAR_NAME} » dans :\n  ${path.dirname(appLocalLtJar())}\n` +
      'ou définissez SCRIPTOR_LANGUAGETOOL_JAR. Téléchargement : https://languagetool.org/download/',
  )
  process.exit(1)
}

const port = Number(process.env.SCRIPTOR_LANGUAGETOOL_PORT || 8010) || 8010

const javaExe = resolveJavaExe()
const child = spawn(javaExe, ['-jar', jar, '--port', String(port)], {
  stdio: 'inherit',
  shell: false,
})

child.on('error', (err) => {
  console.error('[LanguageTool] Impossible de lancer java :', err.message)
  console.error(
    'Installez un JRE (ex. Eclipse Temurin) : https://adoptium.net/temurin/releases/?package=jre',
  )
  process.exit(1)
})

child.on('exit', (code, signal) => {
  if (signal) process.exit(1)
  process.exit(code ?? 1)
})
