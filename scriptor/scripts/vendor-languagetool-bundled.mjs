/**
 * Télécharge un JRE Eclipse Temurin + LanguageTool (serveur) dans
 * src-tauri/resources/languagetool/ pour un MSI plug-and-play (sans Java installé par l’utilisateur).
 *
 * Usage (dossier scriptor/) : npm run vendor:languagetool-bundled
 *
 * Plateformes : Windows x64, macOS aarch64/x64, Linux x64 (arch détectée).
 * Cache : .cache-languagetool-bundled/
 *
 * Versions épinglées — mettre à jour si besoin (sécurité / correctifs).
 */
import { cp, mkdir, readdir, rm, stat } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { dirname, join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUT = join(ROOT, 'src-tauri', 'resources', 'languagetool')
const CACHE = join(ROOT, '.cache-languagetool-bundled')

/** Archive officielle — mettre à jour pour les builds release (reproductibilité). */
const LT_ZIP_NAME = 'LanguageTool-6.6.zip'
const LT_URL = `https://languagetool.org/download/${LT_ZIP_NAME}`

const JAVA_MAJOR = '21'

function adoptiumUrl() {
  const p = process.platform
  const a = process.arch
  if (p === 'win32' && a === 'x64') {
    return `https://api.adoptium.net/v3/binary/latest/${JAVA_MAJOR}/ga/windows/x64/jre/hotspot/normal/eclipse?project=jdk`
  }
  if (p === 'darwin' && a === 'arm64') {
    return `https://api.adoptium.net/v3/binary/latest/${JAVA_MAJOR}/ga/mac/aarch64/jre/hotspot/normal/eclipse?project=jdk`
  }
  if (p === 'darwin' && a === 'x64') {
    return `https://api.adoptium.net/v3/binary/latest/${JAVA_MAJOR}/ga/mac/x64/jre/hotspot/normal/eclipse?project=jdk`
  }
  if (p === 'linux' && a === 'x64') {
    return `https://api.adoptium.net/v3/binary/latest/${JAVA_MAJOR}/ga/linux/x64/jre/hotspot/normal/eclipse?project=jdk`
  }
  return null
}

const JAVA_BIN = process.platform === 'win32' ? 'java.exe' : 'java'

async function downloadToFile(url, dest) {
  await mkdir(dirname(dest), { recursive: true })
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) {
    throw new Error(`Téléchargement ${url} : HTTP ${res.status}`)
  }
  const body = res.body
  if (!body) throw new Error('Réponse vide')
  await pipeline(body, createWriteStream(dest))
}

async function unzip(archive, destDir) {
  await mkdir(destDir, { recursive: true })
  if (process.platform === 'win32') {
    const cmd = `Expand-Archive -LiteralPath '${archive.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force`
    await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', cmd], {
      maxBuffer: 64 * 1024 * 1024,
    })
  } else {
    await execFileAsync('unzip', ['-q', '-o', archive, '-d', destDir])
  }
}

async function findFileRecursive(dir, basename, maxDepth, depth = 0) {
  if (depth > maxDepth) return null
  const entries = await readdir(dir, { withFileTypes: true })
  for (const e of entries) {
    const p = join(dir, e.name)
    if (e.isFile() && e.name === basename) return p
    if (e.isDirectory()) {
      const r = await findFileRecursive(p, basename, maxDepth, depth + 1)
      if (r) return r
    }
  }
  return null
}

async function wipeDir(rel) {
  const p = join(OUT, rel)
  await rm(p, { recursive: true, force: true })
}

async function main() {
  const adoptium = adoptiumUrl()
  if (!adoptium) {
    console.error(
      `[vendor-languagetool-bundled] Plateforme non prise en charge : ${process.platform} ${process.arch}`,
    )
    process.exit(1)
  }

  await mkdir(CACHE, { recursive: true })
  await mkdir(OUT, { recursive: true })

  const jreZip = join(CACHE, `temurin-jre-${JAVA_MAJOR}-${process.platform}-${process.arch}.zip`)
  const ltZip = join(CACHE, LT_ZIP_NAME)
  const jreStage = join(CACHE, 'jre-unpack')
  const ltStage = join(CACHE, 'lt-unpack')

  console.log('[1/4] Téléchargement JRE Temurin (API Adoptium)…')
  await downloadToFile(adoptium, jreZip)
  await rm(jreStage, { recursive: true, force: true })
  await mkdir(jreStage, { recursive: true })
  console.log('[2/4] Extraction JRE…')
  await unzip(jreZip, jreStage)

  const javaPath = await findFileRecursive(jreStage, JAVA_BIN, 8)
  if (!javaPath) {
    throw new Error(`« ${JAVA_BIN} » introuvable dans l’archive JRE.`)
  }
  const jreRoot = dirname(dirname(javaPath))
  await wipeDir('jre')
  await cp(jreRoot, join(OUT, 'jre'), { recursive: true })

  console.log('[3/4] Téléchargement LanguageTool…')
  try {
    await stat(ltZip)
  } catch {
    await downloadToFile(LT_URL, ltZip)
  }
  await rm(ltStage, { recursive: true, force: true })
  await mkdir(ltStage, { recursive: true })
  console.log('[4/4] Extraction LanguageTool…')
  await unzip(ltZip, ltStage)

  const jarPath = await findFileRecursive(ltStage, 'languagetool-server.jar', 12)
  if (!jarPath) {
    throw new Error('languagetool-server.jar introuvable dans l’archive LanguageTool.')
  }
  const destJar = join(OUT, 'languagetool-server.jar')
  await rm(destJar, { force: true })
  await cp(jarPath, destJar)

  const st = await stat(destJar)
  console.log(
    `Terminé. JRE → ${join(OUT, 'jre')} ; JAR → ${destJar} (${(st.size / (1024 * 1024)).toFixed(1)} Mo).`,
  )
  console.log('Ensuite : npm run tauri:build')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
