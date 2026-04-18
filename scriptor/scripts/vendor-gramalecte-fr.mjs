/**
 * Installe le runtime Gramalecte [fr] dans public/gramalecte-fr/ (worker + données).
 *
 * Comportement :
 *   - Si .cache-gramalecte-xpi/unpacked/grammalecte/fr/gc_engine.js existe → copie depuis ce cache.
 *   - Sinon → télécharge l’XPI officiel (AMO) et l’extrait automatiquement (PowerShell sur Windows, unzip ailleurs).
 *
 * Options :
 *   --download     Forcer re-téléchargement + ré-extraction (ignore le cache existant).
 *
 * L’extension Mozilla est sous GPL-3.0-only.
 *
 * Usage (dossier scriptor/) : npm run vendor:gramalecte-fr
 */
import { cp, mkdir, writeFile, stat, copyFile, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUT = join(ROOT, 'public', 'grammalecte-fr')
const CACHE_DIR = join(ROOT, '.cache-gramalecte-xpi')
const UNPACKED = join(CACHE_DIR, 'unpacked')
const XPI_PATH = join(CACHE_DIR, 'grammalecte_fr.xpi')
/** URL directe fichier courant — mettre à jour si AMO change l’id (voir API addons.mozilla.org). */
const XPI_URL =
  'https://addons.mozilla.org/firefox/downloads/file/4643560/grammalecte_fr-2.3.0.xpi'

const REGEXP_POLYFILL = `'use strict';
/* Polyfill RegExp.leftContext / rightContext (SpiderMonkey) pour Chromium — Gramalecte gc_engine */
;(function () {
  if (typeof RegExp.leftContext === 'string') return
  const origExec = RegExp.prototype.exec
  RegExp.prototype.exec = function (str) {
    const m = origExec.call(this, str)
    if (m && typeof str === 'string') {
      RegExp.leftContext = str.slice(0, m.index)
      RegExp.rightContext = str.slice(m.index + m[0].length)
    } else {
      RegExp.leftContext = typeof str === 'string' ? str : ''
      RegExp.rightContext = ''
    }
    return m
  }
})()
`

const WORKER_ENTRY = `/* Scriptor — worker Gramalecte (GPL-3.0, fichiers issus de l’XPI officiel) */
"use strict";
importScripts("regExp-leftContext-polyfill.js");
importScripts("grammalecte/graphspell/helpers.js");
importScripts("grammalecte/graphspell/str_transform.js");
importScripts("grammalecte/graphspell/char_player.js");
importScripts("grammalecte/graphspell/lexgraph_fr.js");
importScripts("grammalecte/graphspell/ibdawg.js");
importScripts("grammalecte/graphspell/spellchecker.js");
importScripts("grammalecte/text.js");
importScripts("grammalecte/graphspell/tokenizer.js");
importScripts("grammalecte/fr/conj.js");
importScripts("grammalecte/fr/mfsp.js");
importScripts("grammalecte/fr/phonet.js");
importScripts("grammalecte/fr/thesaurus.js");
importScripts("grammalecte/fr/cregex.js");
importScripts("grammalecte/fr/gc_options.js");
importScripts("grammalecte/fr/gc_functions.js");
importScripts("grammalecte/fr/gc_rules.js");
importScripts("grammalecte/fr/gc_rules_graph.js");
importScripts("grammalecte/fr/gc_engine.js");
importScripts("grammalecte/tests.js");

function createResponse (sActionDone, result, oInfo, bEnd, bError=false) {
    return {
        "sActionDone": sActionDone,
        "result": result,
        "oInfo": oInfo,
        "bEnd": bEnd,
        "bError": bError
    };
}

function createErrorResult (e, sDescr) {
    return {
        "sType": "error",
        "sDescription": sDescr || "no description",
        "sMessage": (e && (e.message || String(e))) || "error"
    };
}

let bInitDone = false;
let oSpellChecker = null;
let oTokenizer = null;
let oTest = null;

function init (sExtensionPath, dOptions, sContext, oInfo) {
    sContext = sContext || "JavaScript";
    dOptions = dOptions === undefined ? null : dOptions;
    oInfo = oInfo || {};
    try {
        if (!bInitDone) {
            conj.init(helpers.loadFile(sExtensionPath + "/grammalecte/fr/conj_data.json"));
            phonet.init(helpers.loadFile(sExtensionPath + "/grammalecte/fr/phonet_data.json"));
            mfsp.init(helpers.loadFile(sExtensionPath + "/grammalecte/fr/mfsp_data.json"));
            thesaurus.init(
                helpers.loadFile(sExtensionPath + "/grammalecte/fr/thesaurus1_data.json"),
                helpers.loadFile(sExtensionPath + "/grammalecte/fr/thesaurus2_data.json")
            );
            gc_engine.load(sContext, "aHSL", sExtensionPath + "grammalecte/graphspell/_dictionaries");
            oSpellChecker = gc_engine.getSpellChecker();
            oTest = new TestGrammarChecking(gc_engine, sExtensionPath + "/grammalecte/fr/tests_data.json");
            oTokenizer = new Tokenizer("fr");
            if (dOptions !== null) {
                if (!(dOptions instanceof Map)) {
                    dOptions = helpers.objectToMap(dOptions);
                }
                gc_engine.setOptions(dOptions);
            }
            bInitDone = true;
        }
        dOptions = helpers.mapToObject(gc_engine.getOptions());
        postMessage(createResponse("init", dOptions, oInfo, true));
    }
    catch (e) {
        console.error(e);
        postMessage(createResponse("init", createErrorResult(e, "init failed"), oInfo, true, true));
    }
}

function parse (sText, sCountry, bDebug, bContext, oInfo) {
    oInfo = oInfo || {};
    sText = String(sText).replace(/\\u00ad/gi, "").replace(/\\u2011/g, "-").normalize("NFC");
    for (let sParagraph of text.getParagraph(sText)) {
        let aGrammErr = gc_engine.parse(sParagraph, sCountry, bDebug, bContext);
        postMessage(createResponse("parse", aGrammErr, oInfo, false));
    }
    postMessage(createResponse("parse", null, oInfo, true));
}

onmessage = function (e) {
    let {sCommand, oParam, oInfo} = e.data;
    switch (sCommand) {
        case "init":
            init(oParam.sExtensionPath, oParam.dOptions, oParam.sContext, oInfo);
            break;
        case "parse":
            parse(oParam.sText, oParam.sCountry, oParam.bDebug, oParam.bContext, oInfo);
            break;
        default:
            console.log("[Scriptor Grammalecte worker] unknown:", sCommand);
    }
};
`

function escapePsPath(p) {
  return p.replace(/'/g, "''")
}

async function unzipArchive(archivePath, destDir) {
  await mkdir(destDir, { recursive: true })
  if (process.platform === 'win32') {
    const zipPath = archivePath.replace(/\.xpi$/i, '') + '_unpack.zip'
    await copyFile(archivePath, zipPath)
    const cmd = `Expand-Archive -LiteralPath '${escapePsPath(zipPath)}' -DestinationPath '${escapePsPath(destDir)}' -Force`
    await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', cmd], {
      windowsHide: true,
    })
    await rm(zipPath, { force: true })
  } else {
    await execFileAsync('unzip', ['-o', '-q', archivePath, '-d', destDir])
  }
}

async function downloadXpi() {
  console.log('Téléchargement', XPI_URL)
  const res = await fetch(XPI_URL, { redirect: 'follow' })
  if (!res.ok) throw new Error(`HTTP ${res.status} lors du téléchargement de l’XPI`)
  const buf = Buffer.from(await res.arrayBuffer())
  await mkdir(CACHE_DIR, { recursive: true })
  await writeFile(XPI_PATH, buf)
  console.log('XPI enregistré →', XPI_PATH)
}

async function ensureUnpacked(forceDownload) {
  const marker = join(UNPACKED, 'grammalecte', 'fr', 'gc_engine.js')
  if (!forceDownload) {
    try {
      await stat(marker)
      return UNPACKED
    } catch {
      /* fetch */
    }
  } else {
    await rm(UNPACKED, { recursive: true, force: true })
  }

  await mkdir(CACHE_DIR, { recursive: true })
  await downloadXpi()
  await rm(UNPACKED, { recursive: true, force: true })
  await unzipArchive(XPI_PATH, UNPACKED)

  try {
    await stat(marker)
  } catch {
    throw new Error(
      'Extraction XPI : grammalecte/fr/gc_engine.js introuvable. Vérifiez unzip (Linux/macOS) ou PowerShell (Windows).',
    )
  }
  console.log('Extraction →', UNPACKED)
  return UNPACKED
}

async function findUnpackedRoot() {
  const candidates = [UNPACKED, join(ROOT, '.cache-gramalecte-vendor', 'unpacked')]
  for (const c of candidates) {
    try {
      await stat(join(c, 'grammalecte', 'fr', 'gc_engine.js'))
      return c
    } catch {
      /* next */
    }
  }
  return null
}

async function main() {
  const forceDownload = process.argv.includes('--download')

  let srcRoot = await findUnpackedRoot()
  if (forceDownload) {
    srcRoot = await ensureUnpacked(true)
  } else if (!srcRoot) {
    srcRoot = await ensureUnpacked(false)
  }

  await mkdir(OUT, { recursive: true })
  await cp(join(srcRoot, 'grammalecte'), join(OUT, 'grammalecte'), { recursive: true })
  await writeFile(join(OUT, 'regExp-leftContext-polyfill.js'), REGEXP_POLYFILL, 'utf8')
  await writeFile(join(OUT, 'gce_worker_scriptor.js'), WORKER_ENTRY, 'utf8')
  await writeFile(
    join(OUT, 'NOTICE.txt'),
    `Fichiers grammalecte/* extraits de l’extension Mozilla « Gramalecte [fr] » (GPL-3.0-only).\n` +
      `Ne pas modifier sans respecter la licence. Source : https://grammalecte.net\n`,
    'utf8',
  )
  console.log('Grammalecte FR vendored →', OUT)
}

main().catch((e) => {
  console.error(e.message || e)
  console.error(
    '\nManuel : téléchargez l’XPI depuis https://addons.mozilla.org/fr/firefox/addon/grammalecte-fr/\n' +
      `puis extrayez-le dans : ${UNPACKED}\n` +
      'ou réessayez avec une connexion réseau : npm run vendor:gramalecte-fr',
  )
  process.exit(1)
})
