import { spawn } from 'node:child_process'

function runStep(label, script, timeoutMs, env = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script], {
      stdio: 'inherit',
      env: { ...process.env, ...env },
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
  const steps = [
    { label: 'project-store', script: 'scripts/stress-test.mjs', timeoutMs: 90_000 },
    { label: 'backup-retry', script: 'scripts/stress-backup.mjs', timeoutMs: 90_000 },
    {
      label: 'global-desktop-data',
      script: 'scripts/stress-all.mjs',
      timeoutMs: 120_000,
      env: { STRESS_CLOUD_LOOPS: process.env.STRESS_CLOUD_LOOPS || '10' },
    },
  ]

  const failures = []
  for (const step of steps) {
    console.log(`\n--- Stress step: ${step.label} ---`)
    const res = await runStep(step.label, step.script, step.timeoutMs, step.env || {})
    if (!res.ok) failures.push(`${res.label}: ${res.reason}`)
  }

  if (failures.length) {
    console.error('\nStress suite: ECHEC')
    console.error(failures.join('\n'))
    process.exitCode = 1
    return
  }
  console.log('\nStress suite: OK')
}

main().catch((err) => {
  console.error('Stress suite crash:', err?.message || err)
  process.exitCode = 1
})
