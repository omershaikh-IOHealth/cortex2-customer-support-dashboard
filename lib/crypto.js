import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'

function getKey() {
  const key = process.env.ENCRYPTION_KEY
  if (!key) throw new Error('ENCRYPTION_KEY env var is not set')
  // Accept 32-byte hex string (64 chars) or raw 32-char string
  if (key.length === 64) return Buffer.from(key, 'hex')
  if (key.length === 32) return Buffer.from(key, 'utf8')
  throw new Error('ENCRYPTION_KEY must be 32 bytes (raw) or 64 hex chars')
}

export function encrypt(plaintext) {
  try {
    const key = getKey()
    const iv = randomBytes(12)
    const cipher = createCipheriv(ALGORITHM, key, iv)
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    const authTag = cipher.getAuthTag()
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
  } catch (e) {
    if (e.message.startsWith('ENCRYPTION_KEY')) {
      // Fallback: base64-encode when no key is configured
      return `b64:${Buffer.from(plaintext, 'utf8').toString('base64')}`
    }
    throw e
  }
}

export function decrypt(ciphertext) {
  if (ciphertext.startsWith('b64:')) {
    return Buffer.from(ciphertext.slice(4), 'base64').toString('utf8')
  }
  const [ivHex, authTagHex, encryptedHex] = ciphertext.split(':')
  if (!ivHex || !authTagHex || !encryptedHex) throw new Error('Invalid ciphertext format')
  const key = getKey()
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'))
  const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedHex, 'hex')), decipher.final()])
  return decrypted.toString('utf8')
}
