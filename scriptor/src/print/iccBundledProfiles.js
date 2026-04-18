/**
 * Profils ICC embarqués (MIT) — https://github.com/saucecontrol/Compact-ICC-Profiles
 * - sRGB-v2-micro : sortie RVB écran / générique
 * - CGATS001Compat-v2-micro : CMYK « CGATS TR001 / #1 » (proche chaîne GRACoL US ; pas le ICC IDEAlliance complet)
 */
import CGATS001_MICRO_B64 from './icc/cgats001Micro.b64.txt?raw'

// sRGB-v2-micro.icc (identique à l’ancien inline)
const SRGB_MICRO_B64 =
  'AAAByGxjbXMCEAAAbW50clJHQiBYWVogB+IAAwAUAAkADgAdYWNzcE1TRlQAAAAAc2F3c2N0cmwAAAAAAAAAAAAAAAAAAPbWAAEAAAAA0y1oYW5knZEAPUCAsD1AdCyBnqUijgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJZGVzYwAAAPAAAABfY3BydAAAAQwAAAAMd3RwdAAAARgAAAAUclhZWgAAASwAAAAUZ1hZWgAAAUAAAAAUYlhZWgAAAVQAAAAUclRSQwAAAWgAAABgZ1RSQwAAAWgAAABgYlRSQwAAAWgAAABgZGVzYwAAAAAAAAAFdVJHQgAAAAAAAAAAAAAAAHRleHQAAAAAQ0MwAFhZWiAAAAAAAADzVAABAAAAARbJWFlaIAAAAAAAAG+gAAA48gAAA49YWVogAAAAAAAAYpYAALeJAAAY2lhZWiAAAAAAAAAkoAAAD4UAALbEY3VydgAAAAAAAAAqAAAAfAD4AZwCdQODBMkGTggSChgMYg70Ec8U9hhqHC4gQySsKWoufjPrObM/1kZXTTZUdlwXZB1shnVWfo2ILJI2nKunjLLbvpnKx9dl5Hfx+f//'

function decodeIccB64(b64) {
  const bin = atob(String(b64).trim())
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i)
  return out
}

/** @param {Uint8Array} bytes */
export function iccStreamDictForBytes(bytes) {
  if (bytes.length < 20) return { N: 3, Alternate: 'DeviceRGB' }
  const sig = String.fromCharCode(bytes[16], bytes[17], bytes[18], bytes[19])
  if (sig === 'CMYK') return { N: 4, Alternate: 'DeviceCMYK' }
  if (sig === 'RGB ') return { N: 3, Alternate: 'DeviceRGB' }
  if (sig === 'GRAY') return { N: 1, Alternate: 'DeviceGray' }
  return { N: 3, Alternate: 'DeviceRGB' }
}

const CMYK_HINT =
  /GRACOL|SWOP|WEB[\s_-]?COATED|US[\s_-]?WEB|CGATS|FOGRA|ISO[\s_-]?COATED|JAPAN|NEWSPAPER|NEWSSWOP|OFFSET|CMYK|Euroscale|Sheetfed|Coated|Uncoated|Newspaper|PUR|SNAP/i

const RGB_HINT =
  /sRGB|DISPLAY|P3|REC[\s_-]?709|REC[\s_-]?2020|ADOBE\s*RGB|PRO\s*PHOTO|WIDE\s*GAMUT|ECI\s*RGB|WORKING\s*RGB|RGB\s*WORK/i

/**
 * @param {string} [profileLabel]
 * @returns {{ bytes: Uint8Array, streamDict: { N: number, Alternate: string }, technicalId: string, usedCmykBundle: boolean }}
 */
export function resolveBundledIcc(profileLabel) {
  const label = String(profileLabel ?? '').trim()
  const cmyk = CMYK_HINT.test(label)
  const rgb = RGB_HINT.test(label)
  const useCmyk = cmyk || (!rgb && label.length === 0)
  const b64 = useCmyk ? CGATS001_MICRO_B64 : SRGB_MICRO_B64
  const bytes = decodeIccB64(b64)
  return {
    bytes,
    streamDict: iccStreamDictForBytes(bytes),
    technicalId: useCmyk
      ? 'CGATS001Compat-v2-micro (CMYK, MIT Compact-ICC)'
      : 'sRGB-v2-micro (RVB, MIT Compact-ICC)',
    usedCmykBundle: useCmyk,
  }
}

/**
 * @param {string} profileLabel
 * @param {ReturnType<typeof resolveBundledIcc>} resolved
 */
export function userFacingIccNote(profileLabel, resolved) {
  const label = String(profileLabel || 'GRACoL').trim() || 'GRACoL'
  const kind = resolved.usedCmykBundle ? 'CMYK' : 'RVB'
  return `ICC embarqué : ${resolved.technicalId} — étiquette métier « ${label} » (${kind}).`
}
