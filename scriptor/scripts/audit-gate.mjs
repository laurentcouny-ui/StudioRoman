import { execSync } from 'node:child_process'

const ALLOWED_PACKAGES = new Set([
  // Keep temporary exceptions explicit here if a known upstream issue is accepted.
])

function runAudit() {
  try {
    const out = execSync('npm audit --json', {
      encoding: 'utf8',
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return JSON.parse(out)
  } catch (err) {
    const stdout = String(err?.stdout || '')
    if (!stdout.trim()) {
      throw err
    }
    return JSON.parse(stdout)
  }
}

function collectBlockingVulns(report) {
  const vulns = Object.values(report?.vulnerabilities || {})
  const blocking = []
  const ignored = []

  for (const vuln of vulns) {
    const severity = String(vuln?.severity || '').toLowerCase()
    const name = String(vuln?.name || '')
    if (!name || (severity !== 'high' && severity !== 'critical')) {
      continue
    }

    const item = {
      name,
      severity,
      via: Array.isArray(vuln?.via) ? vuln.via.map((v) => (typeof v === 'string' ? v : v?.url || v?.name || 'unknown')) : [],
      fixAvailable: vuln?.fixAvailable || false,
    }

    if (ALLOWED_PACKAGES.has(name)) {
      ignored.push(item)
    } else {
      blocking.push(item)
    }
  }

  return { blocking, ignored }
}

function main() {
  const report = runAudit()
  const { blocking, ignored } = collectBlockingVulns(report)

  console.log(`security:audit -> high+critical (blocking): ${blocking.length}`)
  console.log(`security:audit -> high+critical (allowlisted): ${ignored.length}`)

  if (ignored.length) {
    console.log('allowlist packages (temporary):')
    for (const item of ignored) {
      console.log(`- ${item.name} [${item.severity}]`)
    }
  }

  if (blocking.length) {
    console.error('Blocking vulnerabilities detected:')
    for (const item of blocking) {
      console.error(`- ${item.name} [${item.severity}]`)
      if (item.via.length) {
        console.error(`  via: ${item.via.join(', ')}`)
      }
    }
    process.exitCode = 1
    return
  }
}

main()
