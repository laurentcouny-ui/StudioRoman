/**
 * Préfixe PATH avec ~/.cargo/bin (Windows : souvent absent dans les terminaux IDE).
 * Puis lance `tauri dev` comme `npm run dev:tauri` sans ce fichier.
 */
const { execSync, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const scriptorRoot = path.join(__dirname, "..");
const viteMarker = path.join(scriptorRoot, "node_modules", "vite", "package.json");
if (!fs.existsSync(viteMarker)) {
  console.error(
    "[scriptor] Dependances npm manquantes (vite introuvable). Lancez : npm install\n" +
      "  repertoire : " +
      scriptorRoot
  );
  process.exit(1);
}

const cargoBin = path.join(os.homedir(), ".cargo", "bin");
process.env.PATH = `${cargoBin}${path.delimiter}${process.env.PATH}`;

// Évite d’écraser projet\src-tauri\target\debug\scriptor-tauri.exe encore verrouillé (zombie ou antivirus).
if (process.platform === "win32") {
  const cargoTargetDir = path.join(
    process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"),
    "scriptor-tauri-cargo-target"
  );
  fs.mkdirSync(cargoTargetDir, { recursive: true });
  process.env.CARGO_TARGET_DIR = cargoTargetDir;
}

function sleepMs(ms) {
  try {
    execSync(`powershell -NoProfile -Command "Start-Sleep -Milliseconds ${ms}"`, {
      stdio: "ignore",
      windowsHide: true,
    });
  } catch {
    /* ignore */
  }
}

/** Sans ça Cargo échoue souvent : failed to remove scriptor-tauri.exe (Accès refusé / os error 5). */
function killWindowsTauriInstances() {
  const cmds = [
    "taskkill /F /IM scriptor-tauri.exe",
    'powershell -NoProfile -Command "Get-Process scriptor-tauri -ErrorAction SilentlyContinue | Stop-Process -Force"',
  ];
  for (const c of cmds) {
    try {
      execSync(c, { stdio: "ignore", windowsHide: true, shell: true });
    } catch {
      /* processus absent ou accès refusé */
    }
  }
  sleepMs(800);

  const toUnlink = [
    path.join(scriptorRoot, "src-tauri", "target", "debug", "scriptor-tauri.exe"),
  ];
  if (process.env.CARGO_TARGET_DIR) {
    toUnlink.push(path.join(process.env.CARGO_TARGET_DIR, "debug", "scriptor-tauri.exe"));
  }
  for (const exePath of toUnlink) {
    try {
      fs.unlinkSync(exePath);
    } catch {
      /* encore verrouillé */
    }
  }
}

if (process.platform === "win32") {
  killWindowsTauriInstances();
}

const r = spawnSync("npx", ["@tauri-apps/cli", "dev"], {
  stdio: "inherit",
  cwd: scriptorRoot,
  shell: true,
  env: process.env,
});
process.exit(r.status === null ? 1 : r.status);
