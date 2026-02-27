import pg from 'pg'
import { validateEnv } from './env.js'

const { Pool } = pg

// Singleton pool - reused across all API route invocations in Next.js
let pool

function getPool() {
  if (!pool) {
    validateEnv()
    pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 30000,
      ssl: { rejectUnauthorized: false },
    })
  }
  return pool
}

export default getPool()
