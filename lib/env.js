/**
 * Environment variable validation.
 * Called on first DB connection (lib/db.js) so misconfiguration is caught
 * at startup rather than at runtime during a request.
 */

const REQUIRED = [
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
]

const OPTIONAL_WARN = [
  'CORE42_API_KEY',   // AI Companion will be disabled without it
  'N8N_WEBHOOK_URL',  // Force Sync Now won't work without it
  'CLICKUP_API_TOKEN', // ClickUp push on ticket create/modify
  'AUTH_SECRET',       // NextAuth — required in production
]

let validated = false

export function validateEnv() {
  if (validated) return
  validated = true

  const missing = REQUIRED.filter(k => !process.env[k])
  if (missing.length > 0) {
    throw new Error(
      `[cortex] Missing required environment variables: ${missing.join(', ')}\n` +
      'Copy .env.local.example to .env.local and fill in the values.'
    )
  }

  const warns = OPTIONAL_WARN.filter(k => !process.env[k])
  if (warns.length > 0 && process.env.NODE_ENV !== 'test') {
    console.warn(
      `[cortex] Optional env vars not set (some features will be disabled): ${warns.join(', ')}`
    )
  }
}
