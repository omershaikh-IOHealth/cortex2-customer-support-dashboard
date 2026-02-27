import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'

// NOTE: pool and bcrypt are dynamically imported inside authorize() so that
// this module is safe to load in the Edge runtime (used by middleware).
// The authorize callback only runs in the Node.js runtime (API route).

const MAX_ATTEMPTS = 5
const LOCK_MINUTES = 15

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) return null

        const { default: pool } = await import('@/lib/db')
        const { default: bcrypt } = await import('bcryptjs')
        const crypto = await import('crypto')

        // Extract IP + User-Agent from request headers
        const ip = request?.headers?.get('x-forwarded-for')?.split(',')[0]?.trim()
          || request?.headers?.get('x-real-ip')
          || 'unknown'
        const userAgent = request?.headers?.get('user-agent') || 'unknown'

        async function logAuth(userId, success, reason = null) {
          try {
            await pool.query(
              `INSERT INTO test.auth_logs (user_id, email, success, ip_address, user_agent, failure_reason)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [userId, credentials.email, success, ip, userAgent, reason]
            )
          } catch (_) { /* non-fatal */ }
        }

        try {
          const result = await pool.query(
            `SELECT id, email, password_hash, full_name, role, ziwo_email, ziwo_password,
                    is_active, login_attempts, locked_until
             FROM test.users
             WHERE email = $1
             LIMIT 1`,
            [credentials.email]
          )

          if (result.rows.length === 0) {
            await logAuth(null, false, 'user_not_found')
            return null
          }

          const user = result.rows[0]

          if (!user.is_active) {
            await logAuth(user.id, false, 'account_inactive')
            return null
          }

          // Check lockout
          if (user.locked_until && new Date(user.locked_until) > new Date()) {
            await logAuth(user.id, false, 'account_locked')
            throw new Error(`LOCKED:${new Date(user.locked_until).toISOString()}`)
          }

          const valid = await bcrypt.compare(credentials.password, user.password_hash)

          if (!valid) {
            const newAttempts = (user.login_attempts || 0) + 1
            const locked = newAttempts >= MAX_ATTEMPTS
            await pool.query(
              `UPDATE test.users SET
                 login_attempts = $1,
                 locked_until   = $2,
                 updated_at     = NOW()
               WHERE id = $3`,
              [
                locked ? 0 : newAttempts,
                locked ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000) : null,
                user.id,
              ]
            )
            const reason = locked ? `locked_after_${MAX_ATTEMPTS}_attempts` : 'wrong_password'
            await logAuth(user.id, false, reason)
            if (locked) throw new Error(`LOCKED:${new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString()}`)
            return null
          }

          // Success — reset attempts, set session token, record login
          const sessionToken = crypto.randomBytes(32).toString('hex')
          await pool.query(
            `UPDATE test.users SET
               login_attempts       = 0,
               locked_until         = NULL,
               last_login_at        = NOW(),
               current_session_tok  = $1,
               updated_at           = NOW()
             WHERE id = $2`,
            [sessionToken, user.id]
          )
          await logAuth(user.id, true)

          // Set agent status to 'available' on login (upsert)
          if (user.role === 'agent') {
            pool.query(
              `INSERT INTO test.agent_status (user_id, status, set_at)
               VALUES ($1, 'available', NOW())
               ON CONFLICT (user_id) DO UPDATE SET status = 'available', set_at = NOW()`,
              [user.id]
            ).catch(() => {}) // non-fatal
          }

          return {
            id: String(user.id),
            email: user.email,
            name: user.full_name,
            role: user.role,
            ziwoEmail: user.ziwo_email,
            sessionToken,
          }
        } catch (err) {
          if (err.message?.startsWith('LOCKED:')) throw err
          console.error('[auth] authorize error:', err)
          return null
        }
      },
    }),
  ],

  session: { strategy: 'jwt' },

  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.ziwoEmail = user.ziwoEmail
        token.sessionToken = user.sessionToken
      }
      return token
    },
    session({ session, token }) {
      if (session?.user) {
        session.user.id = token.id
        session.user.role = token.role
        session.user.ziwoEmail = token.ziwoEmail
        session.user.sessionToken = token.sessionToken
      }
      return session
    },
  },

  pages: {
    signIn: '/login',
  },
})
