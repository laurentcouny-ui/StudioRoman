import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const appRoot = path.resolve(__dirname, '..')
const repoRoot = path.resolve(appRoot, '..')

function runStep(label, command, args, cwd, timeoutMs = 300_000) {
  return new Promise((resolve) => {
    console.log(`\n=== ${label} ===`)
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    })
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      resolve({ ok: false, label, reason: `timeout ${timeoutMs}ms` })
    }, timeoutMs)
    child.on('exit', (code) => {
      clearTimeout(timer)
      resolve({
        ok: code === 0,
        label,
        reason: code === 0 ? '' : `exit code ${String(code)}`,
      })
    })
  })
}

async function main() {
  const strictLint = process.env.CDC_STRICT_LINT === '1'
  const steps = [
    ['Frontend lint', 'npm', ['run', '-s', 'lint'], appRoot, 240_000],
    ['Frontend build', 'npm', ['run', '-s', 'build'], appRoot, 240_000],
    ['Stress suite', 'npm', ['run', '-s', 'stress:suite'], appRoot, 300_000],
    ['Rust check', 'cargo', ['check'], path.join(appRoot, 'src-tauri'), 300_000],
    ['Backend compile', 'mvn', ['-q', 'compile', '-DskipTests'], path.join(repoRoot, 'backend'), 420_000],
  ]

  const failures = []
  for (const [label, cmd, args, cwd, timeoutMs] of steps) {
    const res = await runStep(label, cmd, args, cwd, timeoutMs)
    if (!res.ok) {
      const isLintFailure = label === 'Frontend lint'
      if (isLintFailure && !strictLint) {
        console.warn(`WARN: ${label} non bloquant (${res.reason})`)
      } else {
        failures.push(`${res.label}: ${res.reason}`)
      }
    }
  }

  if (failures.length) {
    console.error('\nCDC gate: ECHEC')
    console.error(failures.join('\n'))
    process.exitCode = 1
    return
  }
  console.log('\nCDC gate: OK')
}

main().catch((err) => {
  console.error('CDC gate crash:', err?.message || err)
  process.exitCode = 1
})
