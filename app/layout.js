import './globals.css'
import { Inter } from 'next/font/google'
import { Providers } from './providers'
import { ThemeProvider } from '@/components/ThemeProvider'
import { Toaster } from 'react-hot-toast'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Cortex 2.0 | Support Center Automation',
  description: 'Real-time monitoring and intelligence for MedGulf support operations',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider>
          <Providers>
            {children}
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 3000,
                style: {
                  background: 'var(--cortex-surface, #1e1e2e)',
                  color: 'var(--cortex-text, #e0e0e0)',
                  border: '1px solid var(--cortex-border, #333)',
                },
              }}
            />
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  )
}
