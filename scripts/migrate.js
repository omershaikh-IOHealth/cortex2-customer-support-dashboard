/**
 * Run DB migrations
 * Usage: node scripts/migrate.js
 */
const path = require('path')
const fs = require('fs')

const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf-8').split(/\r?\n/)
  for (const line of lines) {
    const match = line.match(/^([^#=\s]+)\s*=\s*(.*)$/)
    if (match) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '').trim()
    }
  }
}

const { Pool } = require('pg')
const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
})

const sql = fs.readFileSync(
  path.join(__dirname, '..', 'db', 'migrations', '001_auth_tables.sql'),
  'utf-8'
)

async function migrate() {
  const client = await pool.connect()
  try {
    console.log('Running migration 001_auth_tables.sql…')
    await client.query(sql)
    console.log('✓ Migration complete')
  } catch (err) {
    console.error('✗ Migration failed:', err.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

migrate()
