const pg = require('pg')
const fs = require('fs')

const raw = fs.readFileSync('.env.local', 'utf8')
const env = {}
raw.split('\n').forEach(line => {
  line = line.replace(/\r/, '').trim()
  if (!line || line.startsWith('#')) return
  const idx = line.indexOf('=')
  if (idx < 0) return
  const k = line.substring(0, idx).trim()
  let v = line.substring(idx + 1).trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  env[k] = v
})

const pool = new pg.Pool({
  host: env.DB_HOST, port: parseInt(env.DB_PORT || '5432'),
  database: env.DB_NAME, user: env.DB_USER,
  password: env.DB_PASSWORD, ssl: { rejectUnauthorized: false }
})

async function run() {
  const client = await pool.connect()
  try {
    // Check all columns in main.users
    const cols = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'main' AND table_name = 'users'
      ORDER BY ordinal_position
    `)
    console.log('\n=== main.users columns ===')
    cols.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type}, nullable=${r.is_nullable})`))

    // Check admin users
    const users = await client.query(`
      SELECT id, email, role, is_active, login_attempts, locked_until,
             password_hash IS NOT NULL as has_hash,
             last_login_at, current_session_tok IS NOT NULL as has_session_tok
      FROM main.users
      WHERE role = 'admin'
      LIMIT 5
    `)
    console.log('\n=== Admin users ===')
    users.rows.forEach(r => console.log(JSON.stringify(r)))

    // Check agent users too
    const agents = await client.query(`
      SELECT id, email, role, is_active,
             password_hash IS NOT NULL as has_hash
      FROM main.users
      WHERE role = 'agent'
      LIMIT 5
    `)
    console.log('\n=== Agent users ===')
    agents.rows.forEach(r => console.log(JSON.stringify(r)))

  } catch (e) {
    console.error('ERROR:', e.message)
  } finally {
    client.release()
    await pool.end()
  }
}

run()
