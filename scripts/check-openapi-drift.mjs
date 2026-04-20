import { execSync } from 'node:child_process'

function listChangedFiles(baseRef) {
  const cmd = `git diff --name-only ${baseRef}...HEAD`
  const out = execSync(cmd, { encoding: 'utf8' })
  return out
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function isApiContractRelevant(file) {
  if (!file.startsWith('backend/src/main/java/com/scriptor/api/')) return false
  return (
    file.endsWith('Controller.java') ||
    file.endsWith('Request.java') ||
    file.endsWith('Response.java')
  )
}

function main() {
  const baseRef = process.argv[2]
  if (!baseRef) {
    console.log('openapi-drift: no base ref provided, skipping.')
    return
  }

  const changed = listChangedFiles(baseRef)
  const apiTouched = changed.filter(isApiContractRelevant)
  const openapiTouched = changed.includes('backend/openapi/openapi-baseline.yaml')

  if (apiTouched.length > 0 && !openapiTouched) {
    console.error('openapi-drift: API contract-relevant files changed without updating baseline:')
    for (const file of apiTouched) {
      console.error(`- ${file}`)
    }
    console.error('Please update: backend/openapi/openapi-baseline.yaml')
    process.exitCode = 1
    return
  }

  console.log(`openapi-drift: ok (api touched: ${apiTouched.length}, baseline updated: ${openapiTouched})`)
}

main()
