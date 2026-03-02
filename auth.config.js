import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'

// Edge-safe auth config — NO Node.js imports here.
// Middleware imports from this file; auth.js extends it with the full authorize callback.
export const authConfig = {
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      // authorize is intentionally omitted here — it lives in auth.js (Node runtime only).
      // This stub satisfies NextAuth's type requirements for Edge.
      authorize: () => null,
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
}

export const { auth } = NextAuth(authConfig)
