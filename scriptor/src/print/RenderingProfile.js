export const validProfiles = [
  { mode: 'preview', precision: 'fast', color: 'simulated', typography: 'full' },
  { mode: 'print', precision: 'exact', color: 'icc', typography: 'full' },
  { mode: 'ebook', precision: 'fast', color: 'simulated', typography: 'reduced' },
]

function keyOf(profile) {
  return `${profile.mode}|${profile.precision}|${profile.color}|${profile.typography}`
}

const VALID_SET = new Set(validProfiles.map(keyOf))

export function assertValidRenderingProfile(profile) {
  if (!profile || typeof profile !== 'object') {
    throw new Error('RenderingProfile: profile object is required')
  }
  const k = keyOf(profile)
  if (!VALID_SET.has(k)) {
    throw new Error(
      `RenderingProfile: invalid combination "${k}". Allowed combinations: ${[
        ...VALID_SET,
      ].join(', ')}`,
    )
  }
  return Object.freeze({ ...profile })
}

/**
 * Bascules automatiques de contexte.
 * - writing -> preview fast simulated
 * - final-validation -> print exact icc
 * - export-ebook -> ebook fast simulated
 */
export function getRenderingProfileForContext(context) {
  const c = String(context || '').trim().toLowerCase()
  if (c === 'writing' || c === 'edit' || c === 'preview') {
    return assertValidRenderingProfile(validProfiles[0])
  }
  if (c === 'final-validation' || c === 'print-validation' || c === 'print') {
    return assertValidRenderingProfile(validProfiles[1])
  }
  if (c === 'export-ebook' || c === 'ebook' || c === 'epub') {
    return assertValidRenderingProfile(validProfiles[2])
  }
  throw new Error(
    `RenderingProfile: unknown context "${context}". Supported contexts: writing, final-validation, export-ebook`,
  )
}

