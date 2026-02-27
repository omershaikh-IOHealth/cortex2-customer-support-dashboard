import './globals.css'
import { Providers } from './providers'
import { ThemeProvider } from '@/components/ThemeProvider'
import { Toaster } from 'react-hot-toast'

export const metadata = {
  title: 'Cortex 2.0 | Support Center Operations',
  description: 'Real-time monitoring and intelligence for MedGulf support operations',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Prevent dark-mode FOUC — runs synchronously before paint */}
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('cortex-theme');if(!t||t==='dark'){document.documentElement.classList.add('dark')}}catch(e){}` }} />
      </head>
      <body>
        <ThemeProvider>
          <Providers>
            {children}
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 3000,
                style: {
                  background: 'rgb(var(--cortex-surface))',
                  color: 'rgb(var(--cortex-text))',
                  border: '1px solid rgb(var(--cortex-border))',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '14px',
                  borderRadius: '10px',
                  boxShadow: '0 8px 24px rgb(0 0 0 / 0.12)',
                },
              }}
            />
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  )
}
