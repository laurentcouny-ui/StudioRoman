/**
 * Stockage local des secrets Kit Média (clé API Leonardo, etc.) chiffré AES-GCM (Web Crypto).
 * Desktop : préférer invoke Keychain via GenerationEngines ; ce module sert au fallback web.
 */

const MASTER_KEY_B64 = 'scriptor-media-aes-master-v1'

function u8ToB64(buf) {
  let s = ''
  for (let i = 0; i < buf.length; i += 1) s += String.fromCharCode(buf[i])
  return btoa(s)
}

function b64ToU8(s) {
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i)
  return out
}

async function getAesGcmKey() {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('Web Crypto indisponible')
  }
  let stored = null
  try {
    stored = window.localStorage?.getItem(MASTER_KEY_B64)
  } catch {
    /* ignore */
  }
  if (!stored) {
    const raw = new Uint8Array(32)
    crypto.getRandomValues(raw)
    const b64 = u8ToB64(raw)
    try {
      window.localStorage?.setItem(MASTER_KEY_B64, b64)
    } catch {
      /* ignore */
    }
    stored = b64
  }
  const rawKey = b64ToU8(stored)
  return crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

export async function encryptSecretString(plain) {
  const key = await getAesGcmKey()
  const iv = new Uint8Array(12)
  crypto.getRandomValues(iv)
  const enc = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(String(plain ?? '')),
  )
  const out = new Uint8Array(iv.byteLength + enc.byteLength)
  out.set(iv, 0)
  out.set(new Uint8Array(enc), iv.byteLength)
  return u8ToB64(out)
}

export async function decryptSecretString(payloadB64) {
  const key = await getAesGcmKey()
  const all = b64ToU8(payloadB64)
  const iv = all.slice(0, 12)
  const ct = all.slice(12)
  const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct)
  return new TextDecoder().decode(dec)
}
